import { NextRequest, NextResponse } from 'next/server';
import { ACHIEVEMENT_BONUS_DAYS } from '@/lib/achievements';
import { loadAchievementStats } from '@/lib/achievement-stats';
import { activatePremium } from '@/lib/premium';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizeUser } from '@/lib/user-utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Claim +3 days Premium when all monthly achievements are unlocked (once per month). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const userId = auth.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (userRow?.achievement_bonus_month === currentMonth) {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        user: normalizeUser(userRow),
      });
    }

    const achievements = await loadAchievementStats(supabase, userId);
    const allUnlocked = achievements.every((a) => a.unlocked);

    if (!allUnlocked) {
      const remaining = achievements.filter((a) => !a.unlocked).length;
      return NextResponse.json(
        { error: 'Not all achievements unlocked', remaining },
        { status: 400 }
      );
    }

    const { data: claimed, error: claimError } = await supabase
      .from('users')
      .update({ achievement_bonus_month: currentMonth })
      .eq('telegram_user_id', userId)
      .or(`achievement_bonus_month.is.null,achievement_bonus_month.neq.${currentMonth}`)
      .select('*')
      .maybeSingle();

    if (claimError) {
      const missingColumn = claimError.message.includes('achievement_bonus_month');
      if (missingColumn) {
        await activatePremium(userId, ACHIEVEMENT_BONUS_DAYS);
        const { data: refreshed } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_user_id', userId)
          .maybeSingle();
        return NextResponse.json({
          ok: true,
          bonusDays: ACHIEVEMENT_BONUS_DAYS,
          warning: 'Run supabase/patch_achievements.sql to track monthly bonus',
          user: normalizeUser(refreshed),
        });
      }
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (!claimed) {
      const { data: already } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_user_id', userId)
        .maybeSingle();
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        user: normalizeUser(already),
      });
    }

    try {
      await activatePremium(userId, ACHIEVEMENT_BONUS_DAYS);
    } catch (premiumError) {
      await supabase
        .from('users')
        .update({ achievement_bonus_month: userRow?.achievement_bonus_month ?? null })
        .eq('telegram_user_id', userId);
      throw premiumError;
    }

    const { data: updated } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      bonusDays: ACHIEVEMENT_BONUS_DAYS,
      user: normalizeUser(updated),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

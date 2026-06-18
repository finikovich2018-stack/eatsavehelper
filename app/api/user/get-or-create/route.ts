import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizeUser } from '@/lib/user-utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const userId = auth.userId;

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (existing) {
      let user = existing;

      if (existing.is_premium && existing.premium_until && new Date(existing.premium_until) <= new Date()) {
        const { data: expired } = await supabase
          .from('users')
          .update({ is_premium: false })
          .eq('telegram_user_id', userId)
          .select()
          .maybeSingle();
        user = expired || { ...existing, is_premium: false };
      }

      if (user.scans_month !== currentMonth) {
        const { data: updated } = await supabase
          .from('users')
          .update({
            scans_this_month: 0,
            scans_month: currentMonth,
            ai_recipes_this_month: 0,
            ai_recipes_month: currentMonth,
          })
          .eq('telegram_user_id', userId)
          .select()
          .maybeSingle();
        return NextResponse.json({ user: normalizeUser(updated || user) });
      }
      return NextResponse.json({ user: normalizeUser(user) });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: userId,
        first_name: auth.tgUser.first_name,
        username: auth.tgUser.username || null,
        is_premium: false,
        scans_this_month: 0,
        scans_month: currentMonth,
        ai_recipes_this_month: 0,
        ai_recipes_month: currentMonth,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: normalizeUser(newUser) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    console.error('Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

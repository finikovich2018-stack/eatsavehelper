import { NextRequest, NextResponse } from 'next/server';
import { botMsg } from '@/lib/bot-messages';
import { REFERRAL_BONUS_DAYS } from '@/lib/constants';
import { claimReferralByToken } from '@/lib/referral';
import { sendBotMessage } from '@/lib/send-bot-message';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const token = String(body.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const result = await claimReferralByToken(supabase, auth.userId, token);

    if (result.referrerId && result.bonusDays && !result.alreadyClaimed) {
      const { data: referrer } = await supabase
        .from('users')
        .select('telegram_chat_id')
        .eq('telegram_user_id', result.referrerId)
        .maybeSingle();

      if (referrer?.telegram_chat_id) {
        const msg = botMsg('ru');
        const until = result.premiumUntil
          ? new Date(result.premiumUntil).toLocaleDateString('ru-RU')
          : '';
        await sendBotMessage(
          referrer.telegram_chat_id,
          msg.referralReward(REFERRAL_BONUS_DAYS, until),
          { buttonText: msg.openApp }
        );
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

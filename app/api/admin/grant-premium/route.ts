import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/admin';
import { botMsg } from '@/lib/bot-messages';
import { activatePremium, PREMIUM_DAYS, PREMIUM_DAYS_SHORT } from '@/lib/premium';
import { sendBotMessage } from '@/lib/send-bot-message';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';
import { normalizeUser } from '@/lib/user-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin-only: grant or set Premium for 15 or 30 days (mode=extend adds to current expiry) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!isAdminTelegramId(auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetId = Number(body.target_telegram_user_id ?? body.telegram_user_id);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: 'Invalid telegram_user_id' }, { status: 400 });
    }

    const days = Number(body.days);
    const grantDays =
      days === PREMIUM_DAYS_SHORT ? PREMIUM_DAYS_SHORT : PREMIUM_DAYS;

    const fromNow = body.mode !== 'extend';

    await activatePremium(targetId, grantDays, { fromNow });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', targetId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let notified = false;
    const chatId = Number(data?.telegram_chat_id ?? targetId);
    if (chatId > 0 && data?.premium_until) {
      const untilLabel = new Date(data.premium_until).toLocaleDateString('ru-RU');
      const messages = botMsg('ru');
      notified = await sendBotMessage(
        chatId,
        messages.premiumGranted(grantDays, untilLabel, body.mode === 'extend'),
        { buttonText: messages.openApp }
      );
    }

    return NextResponse.json({ ok: true, user: normalizeUser(data), notified });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

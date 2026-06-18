import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { activatePremium } from '@/lib/premium';
import {
  hasRecoverablePremiumPayment,
  markLatestPaymentActivated,
} from '@/lib/premium-payments';
import { getBotToken } from '@/lib/bot-token';
import {
  getInitDataAuthDate,
  parseTelegramUser,
  verifyTelegramInitData,
} from '@/lib/telegram';
import { normalizeUser } from '@/lib/user-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Activate Premium only if a recent Stars payment was logged */
export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const botToken = getBotToken();

    if (!botToken) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }

    if (!initData || !verifyTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid initData' }, { status: 401 });
    }

    const authDate = getInitDataAuthDate(initData);
    if (authDate && Date.now() / 1000 - authDate > 86_400) {
      return NextResponse.json({ error: 'initData expired' }, { status: 401 });
    }

    const tgUser = parseTelegramUser(initData);
    if (!tgUser) {
      return NextResponse.json({ error: 'No user in initData' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const canRecover = await hasRecoverablePremiumPayment(supabase, tgUser.id);
    if (!canRecover) {
      return NextResponse.json(
        { error: 'No recent Stars payment found. Pay in the app first.' },
        { status: 403 }
      );
    }

    await activatePremium(tgUser.id);
    await markLatestPaymentActivated(supabase, tgUser.id);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', tgUser.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: normalizeUser(data) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Activation failed';
    console.error('Premium activate error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

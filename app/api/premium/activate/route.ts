import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { activatePremium } from '@/lib/premium';
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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Activate Premium after Stars payment (openInvoice paid or manual recovery) */
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

    await activatePremium(tgUser.id);

    const supabase = getSupabase();
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

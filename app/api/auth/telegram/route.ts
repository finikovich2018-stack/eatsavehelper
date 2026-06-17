import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getInitDataAuthDate,
  parseTelegramUser,
  verifyTelegramInitData,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    if (!botToken) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }

    if (!verifyTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid initData signature' }, { status: 401 });
    }

    const authDate = getInitDataAuthDate(initData);
    if (authDate && Date.now() / 1000 - authDate > 86_400) {
      return NextResponse.json({ error: 'initData expired' }, { status: 401 });
    }

    const tgUser = parseTelegramUser(initData);
    if (!tgUser) {
      return NextResponse.json({ error: 'No user in initData' }, { status: 400 });
    }

    const supabase = getSupabase();
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', tgUser.id)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, unknown> = {
        first_name: tgUser.first_name,
        username: tgUser.username || null,
        updated_at: new Date().toISOString(),
      };

      if (existing.scans_month !== currentMonth) {
        updates.scans_this_month = 0;
        updates.scans_month = currentMonth;
        updates.ai_recipes_this_month = 0;
        updates.ai_recipes_month = currentMonth;
      }

      const { data: updated, error } = await supabase
        .from('users')
        .update(updates)
        .eq('telegram_user_id', tgUser.id)
        .select()
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ user: updated, telegramUser: tgUser });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: tgUser.id,
        first_name: tgUser.first_name,
        username: tgUser.username || null,
        is_premium: false,
        scans_this_month: 0,
        scans_month: currentMonth,
        ai_recipes_this_month: 0,
        ai_recipes_month: currentMonth,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: newUser, telegramUser: tgUser });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Auth error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

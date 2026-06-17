import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Save chat_id for push. register_only=true does not force notifications on. */
export async function POST(req: NextRequest) {
  try {
    const { telegram_user_id, telegram_chat_id, register_only } = await req.json();
    const userId = Number(telegram_user_id);
    const chatId = Number(telegram_chat_id ?? telegram_user_id);

    if (!userId || !chatId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const currentMonth = now.slice(0, 7);

    const row: Record<string, unknown> = {
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      updated_at: now,
    };

    if (!register_only) {
      row.notifications_enabled = true;
    }

    const { data: existing } = await supabase
      .from('users')
      .select('notifications_enabled')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('users')
        .update(row)
        .eq('telegram_user_id', userId)
        .select('notifications_enabled, telegram_chat_id')
        .maybeSingle();

      if (error) {
        console.error('Subscribe update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        notifications_enabled: data?.notifications_enabled ?? !register_only,
      });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        notifications_enabled: true,
        scans_month: currentMonth,
        ai_recipes_month: currentMonth,
        scans_this_month: 0,
        ai_recipes_this_month: 0,
        updated_at: now,
      })
      .select('notifications_enabled, telegram_chat_id')
      .maybeSingle();

    if (error) {
      console.error('Subscribe insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications_enabled: data?.notifications_enabled ?? true,
    });
  } catch (e) {
    console.error('Subscribe error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/notifications/subscribe
// Saves the user's Telegram chat_id so we can send them push notifications
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { telegram_user_id, telegram_chat_id } = await req.json();

    if (!telegram_user_id || !telegram_chat_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({
        telegram_chat_id,
        notifications_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_user_id', telegram_user_id);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Subscribe error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

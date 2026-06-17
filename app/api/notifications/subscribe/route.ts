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

/** Save chat_id / enable notifications. register_only=true keeps notifications_enabled unchanged. */
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

    if (register_only) {
      const { data, error } = await supabase
        .from('users')
        .update({ telegram_chat_id: chatId, updated_at: now })
        .eq('telegram_user_id', userId)
        .select('notifications_enabled')
        .maybeSingle();

      if (data) {
        return NextResponse.json({
          ok: true,
          notifications_enabled: data.notifications_enabled ?? true,
        });
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const patch: Record<string, unknown> = {
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      updated_at: now,
    };

    if (!register_only) {
      patch.notifications_enabled = true;
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(patch, { onConflict: 'telegram_user_id' })
      .select('notifications_enabled')
      .maybeSingle();

    if (error) {
      console.error('Subscribe upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications_enabled: data?.notifications_enabled ?? !register_only,
    });
  } catch (e) {
    console.error('Subscribe error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

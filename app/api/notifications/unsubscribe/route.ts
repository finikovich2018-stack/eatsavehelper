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

export async function POST(req: NextRequest) {
  try {
    const { telegram_user_id } = await req.json();
    const userId = Number(telegram_user_id);

    if (!userId) {
      return NextResponse.json({ error: 'Missing telegram_user_id' }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update({ notifications_enabled: false, updated_at: now })
      .eq('telegram_user_id', userId)
      .select('notifications_enabled')
      .maybeSingle();

    if (data) {
      return NextResponse.json({
        ok: true,
        notifications_enabled: data.notifications_enabled ?? false,
      });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: created, error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          telegram_user_id: userId,
          telegram_chat_id: userId,
          notifications_enabled: false,
          updated_at: now,
        },
        { onConflict: 'telegram_user_id' }
      )
      .select('notifications_enabled')
      .maybeSingle();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications_enabled: created?.notifications_enabled ?? false,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

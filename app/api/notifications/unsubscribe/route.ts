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

    if (!telegram_user_id) {
      return NextResponse.json({ error: 'Missing telegram_user_id' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from('users')
      .update({
        notifications_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_user_id', telegram_user_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, notifications_enabled: false });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

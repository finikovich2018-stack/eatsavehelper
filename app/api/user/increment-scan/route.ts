import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dyxksakpvdupgutwswlm.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  try {
    const { telegram_user_id } = await req.json();
    
    const { data: user } = await supabase
      .from('users')
      .select('scans_this_month')
      .eq('telegram_user_id', telegram_user_id)
      .single();

    const newCount = (user?.scans_this_month || 0) + 1;
    
    await supabase
      .from('users')
      .update({ scans_this_month: newCount })
      .eq('telegram_user_id', telegram_user_id);

    return NextResponse.json({ scans_this_month: newCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

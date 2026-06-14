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
    if (!telegram_user_id) return NextResponse.json({ error: 'No user id' }, { status: 400 });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const userId = Number(telegram_user_id);

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (existing) {
      if (existing.scans_month !== currentMonth) {
        const { data: updated } = await supabase
          .from('users')
          .update({
            scans_this_month: 0,
            scans_month: currentMonth,
            ai_recipes_this_month: 0,
            ai_recipes_month: currentMonth
          })
          .eq('telegram_user_id', userId)
          .select()
          .maybeSingle();
        return NextResponse.json({ user: updated });
      }
      return NextResponse.json({ user: existing });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        telegram_user_id: userId,
        is_premium: false,
        scans_this_month: 0,
        scans_month: currentMonth,
        ai_recipes_this_month: 0,
        ai_recipes_month: currentMonth,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: newUser });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

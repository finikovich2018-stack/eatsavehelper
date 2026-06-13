import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dyxksakpvdupgutwswlm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eGtzYWtwdmR1cGd1dHdzd2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDAyMzAsImV4cCI6MjA5NjMxNjIzMH0.Zq26AkcECmNQxTNF3cmC1cS4T8-_TQCEDUzKMT1xcaA'
);

export async function POST(req: NextRequest) {
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
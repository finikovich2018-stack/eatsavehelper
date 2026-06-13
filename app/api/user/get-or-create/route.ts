import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dyxksakpvdupgutwswlm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eGtzYWtwdmR1cGd1dHdzd2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDAyMzAsImV4cCI6MjA5NjMxNjIzMH0.Zq26AkcECmNQxTNF3cmC1cS4T8-_TQCEDUzKMT1xcaA'
);

export async function POST(req: NextRequest) {
  try {
    const { telegram_user_id } = await req.json();
    if (!telegram_user_id) return NextResponse.json({ error: 'No user id' }, { status: 400 });

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Получаем или создаём пользователя
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', telegram_user_id)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ telegram_user_id, scans_month: currentMonth, ai_recipes_month: currentMonth })
        .select()
        .single();
      user = newUser;
    }

    // Сбрасываем счётчики если новый месяц
    if (user && user.scans_month !== currentMonth) {
      const { data: updated } = await supabase
        .from('users')
        .update({ scans_this_month: 0, scans_month: currentMonth, ai_recipes_this_month: 0, ai_recipes_month: currentMonth })
        .eq('telegram_user_id', telegram_user_id)
        .select()
        .single();
      user = updated;
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
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
    const userId = Number(telegram_user_id);

    // Пробуем получить пользователя
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (existing) {
      // Сбрасываем счётчики если новый месяц
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

    // Создаём нового пользователя
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
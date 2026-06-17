import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertCanUseAiRecipes, UsageLimitError } from '@/lib/usage-limits';
import { isPremiumActive } from '@/lib/user-utils';

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
    if (!telegram_user_id) {
      return NextResponse.json({ error: 'No user id' }, { status: 400 });
    }

    const user = await assertCanUseAiRecipes(supabase, Number(telegram_user_id));

    if (isPremiumActive(user)) {
      return NextResponse.json({
        ai_recipes_this_month: user.ai_recipes_this_month || 0,
        unlimited: true,
      });
    }

    const newCount = (user.ai_recipes_this_month || 0) + 1;

    await supabase
      .from('users')
      .update({ ai_recipes_this_month: newCount })
      .eq('telegram_user_id', telegram_user_id);

    return NextResponse.json({ ai_recipes_this_month: newCount });
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(
        { error: 'Достигнут лимит AI-рецептов', code: error.code },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

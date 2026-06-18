import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  assertCanUseAiRecipes,
  incrementRecipeCount,
  UsageLimitError,
} from '@/lib/usage-limits';
import { isPremiumActive } from '@/lib/user-utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const user = await assertCanUseAiRecipes(supabase, auth.userId);

    if (isPremiumActive(user)) {
      return NextResponse.json({
        ai_recipes_this_month: user.ai_recipes_this_month || 0,
        unlimited: true,
      });
    }

    const newCount = await incrementRecipeCount(supabase, auth.userId, user);
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

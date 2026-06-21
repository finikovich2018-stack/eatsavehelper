import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope } from '@/lib/data-scope';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function defaultMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Single round-trip summary for the home screen. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const userId = auth.userId;
    const monthStart = String(body.monthStart || defaultMonthStart());
    const scope = await resolveDataScope(supabase, userId);

    const [
      fridgeResult,
      expensesResult,
      budgetsResult,
      recipesResult,
      shoppingResult,
    ] = await Promise.all([
      applyDataScope(supabase.from('fridge_items').select('*'), scope).order(
        'expiry_date',
        { ascending: true }
      ),
      applyDataScope(supabase.from('expenses').select('*'), scope)
        .gte('date', monthStart)
        .order('date', { ascending: false }),
      applyDataScope(
        supabase.from('budgets').select('amount, currency'),
        scope
      ).eq('month', monthStart),
      supabase
        .from('saved_recipes')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', userId),
      applyDataScope(
        supabase
          .from('shopping_list_items')
          .select('*', { count: 'exact', head: true })
          .eq('checked', false),
        scope
      ),
    ]);

    const errors = [
      fridgeResult.error,
      expensesResult.error,
      budgetsResult.error,
      recipesResult.error,
      shoppingResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0]!.message }, { status: 500 });
    }

    return NextResponse.json({
      fridgeItems: fridgeResult.data || [],
      expenses: expensesResult.data || [],
      budgets: budgetsResult.data || [],
      recipeCount: recipesResult.count || 0,
      shoppingCount: shoppingResult.count || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

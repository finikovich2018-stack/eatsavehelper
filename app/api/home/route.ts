import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope } from '@/lib/data-scope';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { formatLocalDate } from '@/lib/utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function defaultMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

    const today = formatLocalDate(new Date());
    const soonEnd = formatLocalDate(addDays(new Date(), 3));

    const [
      expiringResult,
      productCountResult,
      expiringCountResult,
      expensesResult,
      budgetsResult,
      recipesResult,
      shoppingResult,
    ] = await Promise.all([
      applyDataScope(
        supabase.from('fridge_items').select('id, name, icon, expiry_date, quantity'),
        scope
      )
        .gte('expiry_date', today)
        .lte('expiry_date', soonEnd)
        .order('expiry_date', { ascending: true })
        .limit(5),
      applyDataScope(
        supabase.from('fridge_items').select('*', { count: 'exact', head: true }),
        scope
      ),
      applyDataScope(
        supabase.from('fridge_items').select('*', { count: 'exact', head: true }),
        scope
      )
        .gte('expiry_date', today)
        .lte('expiry_date', soonEnd),
      applyDataScope(supabase.from('expenses').select('amount, currency'), scope)
        .gte('date', monthStart),
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
      expiringResult.error,
      productCountResult.error,
      expiringCountResult.error,
      expensesResult.error,
      budgetsResult.error,
      recipesResult.error,
      shoppingResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0]!.message }, { status: 500 });
    }

    return NextResponse.json({
      expiringItems: expiringResult.data || [],
      productCount: productCountResult.count || 0,
      expiringSoonCount: expiringCountResult.count || 0,
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

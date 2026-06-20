import type { SupabaseClient } from '@supabase/supabase-js';
import { formatLocalDate } from '@/lib/utils';
import { computeAchievements } from '@/lib/achievements';

const DEFAULT_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
};

export async function loadAchievementStats(
  supabase: SupabaseClient,
  userId: number
) {
  const monthStart = formatLocalDate(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [fridgeRes, receiptRes, aiRes, expensesRes, budgetsRes] = await Promise.all([
    supabase
      .from('fridge_items')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', userId),
    supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', userId),
    supabase
      .from('saved_recipes')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', userId)
      .eq('source', 'ai'),
    supabase
      .from('expenses')
      .select('amount, date, currency')
      .eq('telegram_user_id', userId)
      .gte('date', monthStart),
    supabase.from('budgets').select('amount, currency').eq('telegram_user_id', userId).eq('month', monthStart),
  ]);

  const expenses = (expensesRes.data || []) as {
    amount: number;
    date: string;
    currency?: string | null;
  }[];

  const byCurrency: Record<string, number> = {};
  expenses.forEach((e) => {
    const cur = e.currency || 'RUB';
    byCurrency[cur] = (byCurrency[cur] || 0) + Number(e.amount) || 0;
  });

  const primaryCurrency = Object.keys(byCurrency)[0] || 'RUB';
  const budgetRows = (budgetsRes.data || []) as { amount: number; currency: string }[];
  const budgetRow = budgetRows.find((b) => b.currency === primaryCurrency);
  const budgetLimit = Number(budgetRow?.amount || DEFAULT_LIMITS[primaryCurrency] || 15000);

  return computeAchievements({
    receiptCount: receiptRes.count || 0,
    aiRecipeCount: aiRes.count || 0,
    expenses,
    budgetLimit,
    primaryCurrency,
    monthStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  });
}

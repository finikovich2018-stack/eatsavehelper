import { formatLocalDate } from '@/lib/utils';

const DEFAULT_BUDGET_RUB = 15000;
const SAVER_TARGET_RUB = 2000;
const CHEF_TARGET_RECIPES = 10;
const BUDGET_STREAK_DAYS = 7;

const DEFAULT_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
  AUD: 700, CAD: 650, CHF: 450, CNY: 3500, JPY: 70000, INR: 40000,
};

export type AchievementId = 'budget' | 'receipt' | 'chef' | 'saver';

export type AchievementProgress = {
  id: AchievementId;
  unlocked: boolean;
  current: number;
  target: number;
};

type ExpenseRow = {
  amount: number;
  date: string;
  currency?: string | null;
};

function saverTargetForLimit(limit: number): number {
  return Math.max(50, Math.round(limit * (SAVER_TARGET_RUB / DEFAULT_BUDGET_RUB)));
}

/** Consecutive days this month where cumulative spend stays within proportional budget */
export function computeBudgetStreakDays(
  expenses: ExpenseRow[],
  limit: number,
  monthStart: Date,
  currency: string,
  today: Date = new Date()
): number {
  const byDate: Record<string, number> = {};
  expenses
    .filter((e) => (e.currency || 'RUB') === currency)
    .forEach((e) => {
      byDate[e.date] = (byDate[e.date] || 0) + Number(e.amount) || 0;
    });

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  let cumulative = 0;
  let maxStreak = 0;
  let currentStreak = 0;

  const cursor = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  while (cursor <= end) {
    const dateStr = formatLocalDate(cursor);
    cumulative += byDate[dateStr] || 0;
    const dayOfMonth = cursor.getDate();
    const allowedSpend = (limit * dayOfMonth) / daysInMonth;

    if (cumulative <= allowedSpend) {
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return maxStreak;
}

export function computeAchievements(input: {
  receiptCount: number;
  aiRecipeCount: number;
  expenses: ExpenseRow[];
  budgetLimit?: number;
  primaryCurrency?: string;
  monthStart: Date;
  today?: Date;
}): AchievementProgress[] {
  const today = input.today ?? new Date();
  const currency = input.primaryCurrency || 'RUB';
  const limit = input.budgetLimit || DEFAULT_LIMITS[currency] || DEFAULT_BUDGET_RUB;
  const spent = input.expenses
    .filter((e) => (e.currency || 'RUB') === currency)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const budgetStreak = computeBudgetStreakDays(
    input.expenses,
    limit,
    input.monthStart,
    currency,
    today
  );

  const saved = Math.max(0, limit - spent);
  const saverTarget = saverTargetForLimit(limit);

  return [
    {
      id: 'budget',
      unlocked: budgetStreak >= BUDGET_STREAK_DAYS,
      current: Math.min(budgetStreak, BUDGET_STREAK_DAYS),
      target: BUDGET_STREAK_DAYS,
    },
    {
      id: 'receipt',
      unlocked: input.receiptCount >= 1,
      current: Math.min(input.receiptCount, 1),
      target: 1,
    },
    {
      id: 'chef',
      unlocked: input.aiRecipeCount >= CHEF_TARGET_RECIPES,
      current: Math.min(input.aiRecipeCount, CHEF_TARGET_RECIPES),
      target: CHEF_TARGET_RECIPES,
    },
    {
      id: 'saver',
      unlocked: spent > 0 && saved >= saverTarget,
      current: spent > 0 ? Math.min(saved, saverTarget) : 0,
      target: saverTarget,
    },
  ];
}

export { DEFAULT_BUDGET_RUB, SAVER_TARGET_RUB, CHEF_TARGET_RECIPES, BUDGET_STREAK_DAYS };
export const ACHIEVEMENT_BONUS_DAYS = 3;

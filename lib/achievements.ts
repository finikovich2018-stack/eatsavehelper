import { formatLocalDate } from '@/lib/utils';

const DEFAULT_BUDGET_RUB = 15000;
const SAVER_TARGET_RUB = 2000;
const CHEF_TARGET_RECIPES = 10;
const BUDGET_STREAK_DAYS = 7;

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

/** Consecutive days this month where cumulative spend stays within proportional budget */
export function computeBudgetStreakDays(
  expenses: ExpenseRow[],
  limit: number,
  monthStart: Date,
  today: Date = new Date()
): number {
  const byDate: Record<string, number> = {};
  expenses
    .filter((e) => (e.currency || 'RUB') === 'RUB')
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
  budgetLimitRub: number;
  monthStart: Date;
  today?: Date;
}): AchievementProgress[] {
  const today = input.today ?? new Date();
  const limit = input.budgetLimitRub || DEFAULT_BUDGET_RUB;
  const rubSpent = input.expenses
    .filter((e) => (e.currency || 'RUB') === 'RUB')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const budgetStreak = computeBudgetStreakDays(
    input.expenses,
    limit,
    input.monthStart,
    today
  );

  const savedRub = Math.max(0, limit - rubSpent);

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
      unlocked: rubSpent > 0 && savedRub >= SAVER_TARGET_RUB,
      current: rubSpent > 0 ? Math.min(savedRub, SAVER_TARGET_RUB) : 0,
      target: SAVER_TARGET_RUB,
    },
  ];
}

export { DEFAULT_BUDGET_RUB, SAVER_TARGET_RUB, CHEF_TARGET_RECIPES, BUDGET_STREAK_DAYS };

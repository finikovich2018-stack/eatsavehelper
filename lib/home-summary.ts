import { writeHomeCache, type HomeCachePayload } from '@/lib/home-cache';

const DEFAULT_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
};

export function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function buildHomeState(data: {
  expiringItems: { id: string; name: string; icon?: string | null; expiry_date?: string | null; quantity?: string | null }[];
  productCount: number;
  expiringSoonCount: number;
  expenses: { amount: number; currency: string }[];
  budgets: { amount: number; currency: string }[];
  recipeCount: number;
  shoppingCount: number;
}): Omit<HomeCachePayload, 'savedAt'> {
  const expiring = (data.expiringItems || []).map((item) => ({
    id: item.id,
    name: item.name,
    icon: item.icon || '📦',
    expiry_date: item.expiry_date || '',
    quantity: item.quantity || '',
  }));
  const stats = {
    products: data.productCount || 0,
    expiringSoon: data.expiringSoonCount || 0,
    recipes: data.recipeCount || 0,
    shopping: data.shoppingCount || 0,
  };

  const byCurrency: Record<string, number> = {};
  (data.expenses || []).forEach((row) => {
    const cur = row.currency || 'RUB';
    byCurrency[cur] = (byCurrency[cur] || 0) + Number(row.amount || 0);
  });

  const budgetRows = data.budgets || [];
  const limits: Record<string, number> = { ...DEFAULT_LIMITS };
  budgetRows.forEach((row) => {
    limits[row.currency] = Number(row.amount);
  });

  const primaryCur =
    Object.keys(byCurrency)[0] ||
    (budgetRows as { currency: string }[])?.[0]?.currency ||
    'RUB';

  const budget = {
    spent: byCurrency[primaryCur] || 0,
    limit: limits[primaryCur] || DEFAULT_LIMITS[primaryCur] || 15000,
    currency: primaryCur,
  };

  return { expiring, stats, budget };
}

/** Start loading home data before the home page mounts. */
export function prefetchHomeSummary(initData: string, telegramUserId: number) {
  const monthStart = getMonthStart();
  void fetch('/api/home', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, telegram_user_id: telegramUserId, monthStart }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || data.error) return;
      writeHomeCache(telegramUserId, buildHomeState(data));
    })
    .catch(() => undefined);
}

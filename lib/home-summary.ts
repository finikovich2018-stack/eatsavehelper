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

export type RawHomeSummary = {
  expiringItems: { id: string; name: string; icon?: string | null; expiry_date?: string | null; quantity?: string | null }[];
  productCount: number;
  expiringSoonCount: number;
  expenses: { amount: number; currency: string }[];
  budgets: { amount: number; currency: string }[];
  recipeCount: number;
  shoppingCount: number;
};

// Dedupe concurrent /api/home requests for the same user+month. The
// TelegramProvider kicks off a prefetch as soon as auth is known, and the
// home page independently wants the same data as soon as it mounts. Without
// this, both fire their own network round trip to the same endpoint, which
// is what caused the extra pause on cold start. Now whichever caller asks
// second just awaits the first caller's in-flight promise.
const inflight = new Map<string, Promise<RawHomeSummary | null>>();

function requestHomeSummary(
  initData: string,
  telegramUserId: number,
  monthStart: string
): Promise<RawHomeSummary | null> {
  const key = `${telegramUserId}:${monthStart}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetch('/api/home', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, telegram_user_id: telegramUserId, monthStart }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data && !data.error ? (data as RawHomeSummary) : null))
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Start loading home data before the home page mounts. */
export function prefetchHomeSummary(initData: string, telegramUserId: number) {
  const monthStart = getMonthStart();
  void requestHomeSummary(initData, telegramUserId, monthStart).then((data) => {
    if (!data) return;
    writeHomeCache(telegramUserId, buildHomeState(data));
  });
}

/**
 * Fetch home summary data, reusing an in-flight prefetch request if one is
 * already running for this user+month instead of firing a second one.
 */
export function fetchHomeSummary(
  initData: string,
  telegramUserId: number,
  monthStart: string
): Promise<RawHomeSummary | null> {
  return requestHomeSummary(initData, telegramUserId, monthStart);
}

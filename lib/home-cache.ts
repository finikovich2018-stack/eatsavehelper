const CACHE_PREFIX = 'eatsave_home_v1';
const CACHE_TTL_MS = 3 * 60 * 1000;

export type HomeConsumeStats = {
  eaten: number;
  wasted: number;
  wasteFreeDays: number;
  wastedMoney: { currency: string; amount: number }[];
} | null;

export type HomeCachePayload = {
  savedAt: number;
  expiring: {
    id: string;
    name: string;
    icon: string;
    expiry_date: string;
    quantity: string;
  }[];
  budget: { spent: number; limit: number; currency: string };
  stats: { products: number; expiringSoon: number; recipes: number; shopping: number };
  consumeStats?: HomeConsumeStats;
};

function cacheKey(userId: number) {
  return `${CACHE_PREFIX}_${userId}`;
}

export function readHomeCache(userId: number): HomeCachePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCachePayload;
    if (!parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHomeCache(userId: number, payload: Omit<HomeCachePayload, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      cacheKey(userId),
      JSON.stringify({ ...payload, savedAt: Date.now() } satisfies HomeCachePayload)
    );
  } catch {
    /* ignore quota errors */
  }
}

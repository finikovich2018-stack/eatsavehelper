const DEFAULT_TTL_MS = 3 * 60 * 1000;

/** Per-user session cache key (prevents cross-account data leaks in one browser). */
export function userCacheKey(base: string, userId: number): string {
  return `${base}:${userId}`;
}

/** Read a TTL-bounded value from sessionStorage. Returns null when missing/stale. */
export function readSessionCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: T };
    if (!parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* ignore quota errors */
  }
}

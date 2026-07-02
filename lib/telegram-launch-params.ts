import type { StoredTelegramUser } from '@/lib/telegram-client-session';

export type ParsedLaunchAuth = {
  initData: string;
  user: StoredTelegramUser;
};

/** Parse Telegram user JSON from initData query string. */
export function parseUserFromInitData(initData: string): StoredTelegramUser | null {
  try {
    const raw = new URLSearchParams(initData).get('user');
    if (!raw) return null;
    const user = JSON.parse(raw) as StoredTelegramUser;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function extractQueryPart(source: string): string {
  if (source.includes('?')) return source.slice(source.indexOf('?') + 1);
  if (source.includes('#')) return source.slice(source.indexOf('#') + 1);
  return source;
}

/** Parse tgWebAppData from a URL or hash fragment (pure, testable). */
export function parseLaunchAuthFromUrl(source: string): ParsedLaunchAuth | null {
  if (!source || !source.includes('tgWebApp')) return null;

  const params = new URLSearchParams(extractQueryPart(source).replace(/^#/, ''));
  let initData = params.get('tgWebAppData') || '';
  if (!initData) return null;

  try {
    initData = decodeURIComponent(initData);
  } catch {
    /* keep raw */
  }

  const user = parseUserFromInitData(initData);
  if (!user) return null;
  return { initData, user };
}

/** Try several URL sources (href, hash, search, navigation entry). */
export function parseLaunchAuthFromSources(sources: string[]): ParsedLaunchAuth | null {
  for (const source of sources) {
    const parsed = parseLaunchAuthFromUrl(source);
    if (parsed) return parsed;
  }
  return null;
}

export function getInitDataAuthAgeSeconds(initData: string): number | null {
  const authDate = new URLSearchParams(initData).get('auth_date');
  if (!authDate) return null;
  const ts = Number(authDate);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor(Date.now() / 1000 - ts));
}

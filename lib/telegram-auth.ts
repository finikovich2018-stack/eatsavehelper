import { retrieveLaunchParams } from '@telegram-apps/sdk';
import { readTelegramSession, writeTelegramSession, type StoredTelegramUser } from '@/lib/telegram-client-session';

export type TelegramAuthSnapshot = {
  initData: string;
  user: StoredTelegramUser;
};

declare global {
  interface Window {
    __EATSAVE_TG__?: TelegramAuthSnapshot;
    __EATSAVE_CAPTURE_TG__?: () => boolean;
  }
}

function parseUserFromInitData(initData: string): StoredTelegramUser | null {
  try {
    const raw = new URLSearchParams(initData).get('user');
    if (!raw) return null;
    const user = JSON.parse(raw) as StoredTelegramUser;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

function authFromLaunchUrl(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;

  const sources = [
    window.location.href,
    window.location.hash.replace(/^#/, ''),
    window.location.search.replace(/^\?/, ''),
  ];

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.name) sources.push(nav.name);
  } catch {
    /* optional */
  }

  for (const source of sources) {
    if (!source || !source.includes('tgWebApp')) continue;

    const query = source.includes('?')
      ? source.slice(source.indexOf('?') + 1)
      : source.includes('#')
        ? source.slice(source.indexOf('#') + 1)
        : source;

    const params = new URLSearchParams(query.replace(/^#/, ''));
    let initData = params.get('tgWebAppData') || '';
    if (!initData) continue;

    try {
      initData = decodeURIComponent(initData);
    } catch {
      /* keep raw */
    }

    const user = parseUserFromInitData(initData);
    if (user) return { initData, user };
  }

  return null;
}

function authFromHash(): TelegramAuthSnapshot | null {
  return authFromLaunchUrl();
}

function authFromWebApp(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;
  const tg = (window as { Telegram?: { WebApp?: { initData?: string; initDataUnsafe?: { user?: StoredTelegramUser } } } })
    .Telegram?.WebApp;
  if (!tg?.initData) return null;

  const user = tg.initDataUnsafe?.user;
  if (!user?.id) {
    const parsed = parseUserFromInitData(tg.initData);
    if (!parsed) return null;
    return { initData: tg.initData, user: parsed };
  }

  return { initData: tg.initData, user };
}

function authFromTelegramSdk(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const lp = retrieveLaunchParams();
    const initData = lp.initDataRaw || '';
    const sdkUser = lp.initData?.user;

    if (initData && sdkUser?.id) {
      return {
        initData,
        user: {
          id: sdkUser.id,
          first_name: sdkUser.firstName,
          username: sdkUser.username,
          is_premium: sdkUser.isPremium,
        },
      };
    }

    if (initData) {
      const parsed = parseUserFromInitData(initData);
      if (parsed) return { initData, user: parsed };
    }
  } catch {
    /* not in Telegram or launch params unavailable yet */
  }

  return null;
}

function persistAuth(auth: TelegramAuthSnapshot) {
  window.__EATSAVE_TG__ = auth;
  writeTelegramSession(auth.initData, auth.user);
}

/** Read Telegram auth from every source available in the WebView. */
export function getTelegramAuthSnapshot(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;

  window.__EATSAVE_CAPTURE_TG__?.();

  const cached =
    window.__EATSAVE_TG__ ||
    authFromTelegramSdk() ||
    authFromWebApp() ||
    authFromLaunchUrl() ||
    readTelegramSession();

  if (cached) persistAuth(cached);
  return cached;
}

export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp) return true;
  if (window.location.hash.includes('tgWebApp') || window.location.search.includes('tgWebApp')) return true;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.name?.includes('tgWebApp')) return true;
  } catch {
    /* optional */
  }
  return /Telegram/i.test(navigator.userAgent);
}

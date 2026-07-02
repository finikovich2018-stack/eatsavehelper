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

function authFromHash(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  const params = new URLSearchParams(hash);
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
    authFromWebApp() ||
    authFromHash() ||
    readTelegramSession();

  if (cached) persistAuth(cached);
  return cached;
}

export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp) return true;
  if (window.location.hash.includes('tgWebApp')) return true;
  return /Telegram/i.test(navigator.userAgent);
}

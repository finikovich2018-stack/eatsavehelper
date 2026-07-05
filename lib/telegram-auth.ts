import { retrieveLaunchParams } from '@telegram-apps/sdk';
import {
  clearTelegramSession,
  readTelegramSession,
  writeTelegramSession,
  type StoredTelegramUser,
} from '@/lib/telegram-client-session';
import {
  isInitDataFresh,
  parseLaunchAuthFromSources,
  parseUserFromInitData,
  type ParsedLaunchAuth,
} from '@/lib/telegram-launch-params';
import {
  collectWebViewSignals,
  isTelegramWebViewFromSignals,
} from '@/lib/telegram-webview';

export type TelegramAuthSnapshot = ParsedLaunchAuth;

declare global {
  interface Window {
    __EATSAVE_TG__?: TelegramAuthSnapshot;
    __EATSAVE_CAPTURE_TG__?: () => boolean;
  }
}

function authFromLaunchUrl(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;

  const signals = collectWebViewSignals(window, performance);
  return parseLaunchAuthFromSources([
    signals.href,
    signals.hash.replace(/^#/, ''),
    signals.search.replace(/^\?/, ''),
    signals.navigationUrl,
  ]);
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

function isValidSnapshot(auth: TelegramAuthSnapshot | null | undefined): auth is TelegramAuthSnapshot {
  return Boolean(auth?.initData?.trim() && auth.user?.id && isInitDataFresh(auth.initData));
}

function persistAuth(auth: TelegramAuthSnapshot) {
  window.__EATSAVE_TG__ = auth;
  writeTelegramSession(auth.initData, auth.user);
}

function clearStaleAuthCaches() {
  clearTelegramSession();
  delete window.__EATSAVE_TG__;
  try {
    sessionStorage.removeItem('launchParams');
  } catch {
    /* ignore */
  }
}

/** Read Telegram auth from every source available in the WebView. */
export function getTelegramAuthSnapshot(): TelegramAuthSnapshot | null {
  if (typeof window === 'undefined') return null;

  window.__EATSAVE_CAPTURE_TG__?.();

  // Live WebApp data first — stale sessionStorage/SDK must not override fresh initData.
  const candidates: Array<TelegramAuthSnapshot | null> = [
    authFromWebApp(),
    authFromLaunchUrl(),
    authFromTelegramSdk(),
    window.__EATSAVE_TG__ ?? null,
    readTelegramSession(),
  ];

  for (const auth of candidates) {
    if (isValidSnapshot(auth)) {
      persistAuth(auth);
      return auth;
    }
  }

  if (candidates.some((auth) => auth?.initData && !isInitDataFresh(auth.initData))) {
    clearStaleAuthCaches();
  }

  return null;
}

export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return isTelegramWebViewFromSignals(collectWebViewSignals(window, performance));
}

/** Shared Telegram WebView detection (single source of truth). */

export function urlLooksLikeTelegramLaunch(url: string): boolean {
  return url.includes('tgWebApp');
}

export function userAgentLooksLikeTelegram(userAgent: string): boolean {
  return /Telegram/i.test(userAgent);
}

export type WebViewSignals = {
  hasTelegramWebApp: boolean;
  href: string;
  hash: string;
  search: string;
  navigationUrl: string;
  userAgent: string;
};

export function collectWebViewSignals(
  win: Pick<Window, 'location'> & { navigator: Pick<Navigator, 'userAgent'> },
  perf?: Pick<Performance, 'getEntriesByType'>
): WebViewSignals {
  let navigationUrl = '';
  try {
    const nav = perf?.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    navigationUrl = nav?.name || '';
  } catch {
    navigationUrl = '';
  }

  return {
    hasTelegramWebApp: Boolean(
      (win as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
    ),
    href: win.location.href,
    hash: win.location.hash,
    search: win.location.search,
    navigationUrl,
    userAgent: win.navigator.userAgent,
  };
}

export function isTelegramWebViewFromSignals(signals: WebViewSignals): boolean {
  if (signals.hasTelegramWebApp) return true;
  if (urlLooksLikeTelegramLaunch(signals.hash) || urlLooksLikeTelegramLaunch(signals.search)) {
    return true;
  }
  if (urlLooksLikeTelegramLaunch(signals.navigationUrl)) return true;
  return userAgentLooksLikeTelegram(signals.userAgent);
}

export async function purgeServiceWorkersAndCaches(): Promise<void> {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

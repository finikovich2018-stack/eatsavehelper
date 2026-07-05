'use client';

import { useEffect, useRef } from 'react';
import { isTelegramWebView } from '@/lib/telegram-auth';
import { purgeServiceWorkersAndCaches } from '@/lib/telegram-webview';

/** Never register SW in Telegram — stale SW/cache breaks Mini App auth. */
export default function ServiceWorkerRegister() {
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
    if (started.current) return;
    started.current = true;

    if (isTelegramWebView()) {
      void purgeServiceWorkersAndCaches();
      return;
    }

    const hasWebApp = Boolean(
      (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
    );
    if (hasWebApp) {
      void purgeServiceWorkersAndCaches();
      return;
    }

    const BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || '0';

    void (async () => {
      const reloadKey = `eatsave-sw-reload-${BUILD_ID}`;
      const storedBuild = localStorage.getItem('eatsave-build-id');

      if (storedBuild && storedBuild !== BUILD_ID && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        await purgeServiceWorkersAndCaches();
        localStorage.setItem('eatsave-build-id', BUILD_ID);
        window.location.reload();
        return;
      }

      localStorage.setItem('eatsave-build-id', BUILD_ID);
      if (!('serviceWorker' in navigator)) return;

      try {
        await navigator.serviceWorker.register(`/sw.js?b=${BUILD_ID}`);
      } catch {
        /* optional */
      }
    })();
  }, []);

  return null;
}

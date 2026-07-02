'use client';

import { useEffect, useRef } from 'react';

/** Disabled in Mini App — SW reload/cache logic breaks Telegram WebView auth. */
export default function ServiceWorkerRegister() {
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
    if (started.current) return;
    started.current = true;

    const tg = (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
    const inTelegram =
      Boolean(tg) ||
      window.location.hash.includes('tgWebApp') ||
      /Telegram/i.test(navigator.userAgent);

    if (inTelegram) return;

    const BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || '0';

    void (async () => {
      const reloadKey = `eatsave-sw-reload-${BUILD_ID}`;
      const storedBuild = localStorage.getItem('eatsave-build-id');

      if (storedBuild && storedBuild !== BUILD_ID && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
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

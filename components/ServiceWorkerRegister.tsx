'use client';

import { useEffect, useRef } from 'react';

const BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || '0';

function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = (window as { Telegram?: { WebApp?: { platform?: string; initData?: string } } }).Telegram?.WebApp;
  return Boolean(tg?.initData || (tg?.platform && tg.platform !== 'unknown'));
}

async function clearAllCaches() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

async function unregisterAllWorkers() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
}

/** Registers SW (offline only). Skipped in Telegram WebView to avoid reload/cache bugs. */
export default function ServiceWorkerRegister() {
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return;
    }

    if (started.current) return;
    started.current = true;

    const bootstrap = async () => {
      // Telegram Mini App: SW reload loops and stale chunks cause "frozen" UI in WebView.
      if (isTelegramMiniApp()) {
        await unregisterAllWorkers();
        await clearAllCaches();
        return;
      }

      const reloadKey = `eatsave-sw-reload-${BUILD_ID}`;
      const storedBuild = localStorage.getItem('eatsave-build-id');

      if (storedBuild && storedBuild !== BUILD_ID && !sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        await unregisterAllWorkers();
        await clearAllCaches();
        localStorage.setItem('eatsave-build-id', BUILD_ID);
        window.location.reload();
        return;
      }

      localStorage.setItem('eatsave-build-id', BUILD_ID);

      if (!('serviceWorker' in navigator)) return;

      try {
        await navigator.serviceWorker.register(`/sw.js?b=${BUILD_ID}`);
      } catch {
        /* SW optional */
      }
    };

    if (document.readyState === 'complete') {
      void bootstrap();
    } else {
      window.addEventListener('load', () => void bootstrap(), { once: true });
    }
  }, []);

  return null;
}

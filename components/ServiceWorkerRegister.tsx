'use client';

import { useEffect, useRef } from 'react';

const BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID || '0';

function tailwindLoaded(): boolean {
  const probe = document.createElement('div');
  probe.className = 'hidden';
  probe.style.cssText = 'position:absolute;pointer-events:none;opacity:0';
  document.body.appendChild(probe);
  const ok = getComputedStyle(probe).display === 'none';
  probe.remove();
  return ok;
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

/** Registers SW (offline only) and keeps clients on the latest deploy. */
export default function ServiceWorkerRegister() {
  const reloadedForUpdate = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return;
    }

    let cancelled = false;
    let removeVisibleListener: (() => void) | undefined;
    let removeControllerListener: (() => void) | undefined;

    const bootstrap = async () => {
      const storedBuild = localStorage.getItem('eatsave-build-id');
      if (storedBuild && storedBuild !== BUILD_ID) {
        await unregisterAllWorkers();
        await clearAllCaches();
        localStorage.setItem('eatsave-build-id', BUILD_ID);
        window.location.reload();
        return;
      }
      localStorage.setItem('eatsave-build-id', BUILD_ID);

      if (!('serviceWorker' in navigator) || cancelled) return;

      const onControllerChange = () => {
        if (reloadedForUpdate.current) return;
        reloadedForUpdate.current = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      removeControllerListener = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      };

      try {
        const reg = await navigator.serviceWorker.register(`/sw.js?b=${BUILD_ID}`);
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        await reg.update();
      } catch {
        /* SW optional */
      }

      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          navigator.serviceWorker.getRegistration().then((r) => r?.update());
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      removeVisibleListener = () => {
        document.removeEventListener('visibilitychange', onVisible);
      };
    };

    const start = () => {
      void bootstrap();
    };

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }

    const recoverTimer = window.setTimeout(async () => {
      if (cancelled) return;
      if (sessionStorage.getItem('eatsave-css-recovered')) return;
      if (tailwindLoaded()) return;
      sessionStorage.setItem('eatsave-css-recovered', '1');
      await unregisterAllWorkers();
      await clearAllCaches();
      window.location.reload();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(recoverTimer);
      removeVisibleListener?.();
      removeControllerListener?.();
    };
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';

const SW_URL = '/sw.js?v=8';

/** Registers the PWA service worker (production only). Recovers if CSS failed to load. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') {
      return;
    }

    const register = () => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.register(SW_URL).catch(() => {});
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    const recoverStaleCache = async () => {
      if (sessionStorage.getItem('eatsave-css-recovered')) return;

      const probe = document.createElement('div');
      probe.className = 'hidden';
      probe.style.position = 'absolute';
      probe.style.pointerEvents = 'none';
      document.body.appendChild(probe);
      const tailwindOk = getComputedStyle(probe).display === 'none';
      probe.remove();

      if (tailwindOk) return;

      sessionStorage.setItem('eatsave-css-recovered', '1');

      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* ignore */
      }

      window.location.reload();
    };

    const timer = window.setTimeout(recoverStaleCache, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useTelegram } from './TelegramProvider';

const MIN_SPLASH_MS = 400;
const MAX_SPLASH_MS = 2500;

function dismissSplash() {
  const globalDismiss = (window as { __EATSAVE_DISMISS_SPLASH__?: () => void }).__EATSAVE_DISMISS_SPLASH__;
  if (typeof globalDismiss === 'function') {
    globalDismiss();
    return;
  }

  const splash = document.getElementById('eatsave-splash');
  if (!splash || splash.classList.contains('eatsave-splash-out')) return;

  splash.classList.add('eatsave-splash-out');
  window.setTimeout(() => splash.remove(), 360);
}

/** Hides the static HTML splash once Telegram auth bootstrap finishes. */
export default function SplashDismiss() {
  const { loading } = useTelegram();

  useEffect(() => {
    const failSafe = window.setTimeout(dismissSplash, MAX_SPLASH_MS);
    return () => window.clearTimeout(failSafe);
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = window.setTimeout(dismissSplash, MIN_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useTelegram } from './TelegramProvider';

const MIN_SPLASH_MS = 650;

/** Hides the static HTML splash once Telegram auth bootstrap finishes. */
export default function SplashDismiss() {
  const { loading } = useTelegram();

  useEffect(() => {
    if (loading) return;

    const splash = document.getElementById('eatsave-splash');
    if (!splash) return;

    const timer = window.setTimeout(() => {
      splash.classList.add('eatsave-splash-out');
      window.setTimeout(() => splash.remove(), 360);
    }, MIN_SPLASH_MS);

    return () => window.clearTimeout(timer);
  }, [loading]);

  return null;
}

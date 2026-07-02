'use client';

import { useEffect, useState } from 'react';
import { getTelegramAuthSnapshot, isTelegramWebView } from '@/lib/telegram-auth';

type Status = {
  ua: string;
  href: string;
  navUrl: string;
  hash: string;
  search: string;
  isTelegramWebView: boolean;
  hasTelegramWebApp: boolean;
  initDataLen: number;
  userName: string | null;
  userId: number | null;
  swCount: number;
  storageInitLen: number;
  captureOk: boolean;
};

export default function TgStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    void (async () => {
      let navUrl = '';
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        navUrl = nav?.name || '';
      } catch {
        navUrl = '';
      }

      const captureOk = Boolean(
        (window as { __EATSAVE_CAPTURE_TG__?: () => boolean }).__EATSAVE_CAPTURE_TG__?.()
      );
      const snap = getTelegramAuthSnapshot();

      let swCount = 0;
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        swCount = regs.length;
      }

      setStatus({
        ua: navigator.userAgent,
        href: window.location.href,
        navUrl,
        hash: window.location.hash,
        search: window.location.search,
        isTelegramWebView: isTelegramWebView(),
        hasTelegramWebApp: Boolean(
          (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp
        ),
        initDataLen: snap?.initData?.length || 0,
        userName: snap?.user?.first_name || null,
        userId: snap?.user?.id || null,
        swCount,
        storageInitLen: sessionStorage.getItem('eatsave_tg_init')?.length || 0,
        captureOk,
      });
    })();
  }, []);

  if (!status) {
    return (
      <main className="min-h-screen bg-background text-foreground p-4">
        <p className="text-sm text-muted">Диагностика…</p>
      </main>
    );
  }

  const rows: [string, string | number | boolean][] = [
    ['Telegram WebView', status.isTelegramWebView],
    ['Telegram.WebApp', status.hasTelegramWebApp],
    ['initData (символов)', status.initDataLen],
    ['user id', status.userId ?? '—'],
    ['имя', status.userName ?? '—'],
    ['sessionStorage initData', status.storageInitLen],
    ['capture()', status.captureOk],
    ['service workers', status.swCount],
    ['User-Agent', status.ua],
    ['location.href', status.href],
    ['navigation URL', status.navUrl || '—'],
    ['hash', status.hash || '—'],
    ['search', status.search || '—'],
  ];

  return (
    <main className="min-h-screen bg-background text-foreground p-4 pb-24">
      <h1 className="text-xl font-bold mb-2">Диагностика Telegram</h1>
      <p className="text-sm text-muted mb-4">
        Откройте эту страницу через бота и сделайте скриншот, если профиль показывает «Пользователь».
      </p>
      <div className="space-y-2 text-xs break-all">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface/40 p-3">
            <div className="text-muted mb-1">{label}</div>
            <div className="font-mono text-foreground">{String(value)}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

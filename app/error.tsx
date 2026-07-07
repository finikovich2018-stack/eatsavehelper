'use client';

import { useEffect } from 'react';

/**
 * Catches render errors anywhere under the root layout so a bug in one
 * page (e.g. a null-reference when Telegram auth hasn't resolved yet)
 * shows a recoverable screen instead of leaving the app blank/frozen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('EatSave render error:', error);
  }, [error]);

  return (
    <main className="bg-background text-foreground min-h-screen flex items-center justify-center px-6">
      <div className="max-w-mobile w-full rounded-3xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-6 text-center">
        <p className="text-3xl mb-2">⚠️</p>
        <h1 className="text-lg font-bold mb-2">Что-то пошло не так</h1>
        <p className="text-sm text-yellow-100/80 mb-5">
          Произошла непредвиденная ошибка. Попробуйте обновить экран — обычно это помогает.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="rounded-2xl bg-accent text-background font-semibold py-3"
          >
            Обновить
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-accent/40 text-accent font-medium py-3"
          >
            Перезагрузить приложение
          </button>
        </div>
      </div>
    </main>
  );
}

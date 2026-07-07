'use client';

import { useEffect } from 'react';

/**
 * Fallback if the root layout itself throws (rarer, but without this the
 * Mini App shows nothing at all and Telegram reports it as unresponsive).
 * Must render its own <html>/<body> since it replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('EatSave global render error:', error);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ background: '#0C0F0A', color: '#F0F4EC' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: 360,
              width: '100%',
              borderRadius: 24,
              border: '1px solid rgba(234,179,8,0.4)',
              background: 'rgba(234,179,8,0.1)',
              padding: '24px 20px',
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>⚠️</p>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              EatSave не смог загрузиться
            </h1>
            <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 20 }}>
              Полностью закройте приложение и откройте снова через кнопку «📱 Открыть EatSave» в
              боте.
            </p>
            <button
              onClick={reset}
              style={{
                width: '100%',
                borderRadius: 16,
                background: '#7ED957',
                color: '#0C0F0A',
                fontWeight: 600,
                padding: '12px 20px',
                border: 0,
              }}
            >
              Обновить
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTelegramAuthSnapshot } from '@/lib/telegram-auth';
import { writeTelegramSession } from '@/lib/telegram-client-session';
import { HOUSEHOLD_BOT_USERNAME } from '@/lib/constants';

interface TelegramWidgetUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramWebLogin?: (user: TelegramWidgetUser) => void;
  }
}

export default function WebLoginPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Already have a valid session (from a previous web login, or opened
    // inside Telegram directly) — skip the widget entirely.
    if (getTelegramAuthSnapshot()) {
      router.replace('/home');
      return;
    }

    window.onTelegramWebLogin = async (tgUser) => {
      setStatus('verifying');
      setErrorMsg('');
      try {
        const res = await fetch('/api/auth/web-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tgUser),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Не удалось войти');

        writeTelegramSession(data.initData, data.user);
        router.replace('/home');
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Не удалось войти через Telegram');
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', HOUSEHOLD_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '16');
    script.setAttribute('data-onauth', 'onTelegramWebLogin(user)');
    script.setAttribute('data-request-access', 'write');
    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramWebLogin;
    };
  }, [router]);

  return (
    <main className="bg-background text-foreground min-h-screen flex items-center justify-center px-6">
      <div className="max-w-mobile w-full rounded-3xl border border-accent/30 bg-accent/5 px-6 py-8 text-center">
        <p className="text-4xl mb-3">🥗</p>
        <h1 className="text-xl font-bold mb-2">Вход в EatSave</h1>
        <p className="text-sm text-foreground/70 mb-6">
          Войдите через Telegram — это займёт секунду, отдельный пароль не нужен.
        </p>

        <div ref={containerRef} className="flex justify-center min-h-[44px]" />

        {status === 'verifying' && (
          <p className="text-sm text-accent mt-4">Проверяем вход…</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-400 mt-4">{errorMsg}</p>
        )}

        <p className="text-xs text-foreground/40 mt-6">
          Не открывается кнопка? Убедитесь, что не блокируете скрипты telegram.org, или откройте
          EatSave напрямую в{' '}
          <a
            href={`https://t.me/${HOUSEHOLD_BOT_USERNAME}/app`}
            className="text-accent underline"
          >
            Telegram-боте
          </a>
          .
        </p>
      </div>
    </main>
  );
}

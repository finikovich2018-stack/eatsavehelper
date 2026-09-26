'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import { userDisplayLabel } from '@/lib/sync-user-profile';
import { useDataAuth } from '@/lib/use-data-auth';
import { useTelegram } from '@/components/TelegramProvider';

/** Shows Telegram's native chrome back button while this page is mounted,
 *  and routes it to `fallback` (or browser back if there's in-app history). */
function useTelegramBackButton(onBack: () => void) {
  useEffect(() => {
    const tg = (window as {
      Telegram?: { WebApp?: { BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void } } };
    }).Telegram?.WebApp;
    const backButton = tg?.BackButton;
    if (!backButton) return;

    backButton.onClick(onBack);
    backButton.show();

    return () => {
      backButton.offClick(onBack);
      backButton.hide();
    };
  }, [onBack]);
}

type AdminStats = {
  totalUsers: number;
  newLast7Days: number;
  newToday: number;
  premiumUsers: number;
  notificationsOn: number;
  totalReceipts: number;
  totalFridgeItems: number;
  totalSavedRecipes: number;
};

type RecentUser = {
  telegram_user_id: number;
  first_name: string | null;
  username: string | null;
  is_premium: boolean | null;
  premium_until: string | null;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const auth = useDataAuth();
  const { user, loading: tgLoading } = useTelegram();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'forbidden' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [grantBusy, setGrantBusy] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [allLoading, setAllLoading] = useState(false);

  useTelegramBackButton(
    useCallback(() => {
      if (window.history.length > 1) router.back();
      else router.push('/profile');
    }, [router])
  );

  const grantPremium = async (
    telegramUserId: number,
    days: 15 | 30,
    isPremium: boolean,
    mode: 'set' | 'extend' = 'set'
  ) => {
    if (!auth) return;
    const message =
      mode === 'extend'
        ? `Продлить Premium на ${days} дней?`
        : isPremium
          ? `Установить Premium на ${days} дней с сегодня? Текущий срок будет заменён.`
          : `Выдать Premium на ${days} дней?`;
    if (!confirm(message)) return;
    setGrantBusy(telegramUserId);
    try {
      const res = await fetch('/api/admin/grant-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: auth.initData,
          telegram_user_id: auth.telegram_user_id,
          target_telegram_user_id: telegramUserId,
          days,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка');
        return;
      }
      await load();
    } finally {
      setGrantBusy(null);
    }
  };

  const load = useCallback(async (all = false) => {
    if (!auth) return;
    if (all) setAllLoading(true);
    else setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: auth.initData, telegram_user_id: auth.telegram_user_id, all }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setStatus('forbidden');
        return;
      }
      if (!res.ok) {
        setStatus('error');
        setError(data.error || 'Failed to load');
        return;
      }
      setStats(data.stats);
      setRecentUsers(data.recentUsers || []);
      setStatus('ready');
      if (all) setShowAll(true);
    } catch {
      setStatus('error');
      setError('Network error');
    } finally {
      if (all) setAllLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    if (!tgLoading && auth) load();
  }, [tgLoading, auth, load]);

  if (tgLoading || (auth && status === 'loading')) {
    return (
      <div className="bg-background">
        <TopBar title="Admin" />
        <div className="p-4 text-muted text-center">Загрузка…</div>
      </div>
    );
  }

  if (!auth || !user) {
    return (
      <div className="bg-background">
        <TopBar title="Admin" />
        <div className="p-4 text-center text-muted">Откройте страницу через Telegram Mini App.</div>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="bg-background">
        <TopBar title="Admin" />
        <div className="p-4 text-center space-y-2">
          <p className="text-muted">Нет доступа.</p>
          <p className="text-sm text-muted">
            Ваш Telegram ID: <span className="text-accent font-mono">{user.id}</span>
          </p>
          <p className="text-xs text-muted">
            Добавьте его в Vercel → ADMIN_TELEGRAM_IDS и redeploy.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-background">
        <TopBar title="Admin" />
        <div className="p-4 text-center text-red-400">{error}</div>
      </div>
    );
  }

  const cards: { label: string; value: number; icon: string }[] = [
    { label: 'Всего пользователей', value: stats?.totalUsers ?? 0, icon: '👥' },
    { label: 'Новых сегодня', value: stats?.newToday ?? 0, icon: '🆕' },
    { label: 'Новых за 7 дней', value: stats?.newLast7Days ?? 0, icon: '📈' },
    { label: 'Premium', value: stats?.premiumUsers ?? 0, icon: '⭐' },
    { label: 'Уведомления вкл.', value: stats?.notificationsOn ?? 0, icon: '🔔' },
    { label: 'Чеков', value: stats?.totalReceipts ?? 0, icon: '🧾' },
    { label: 'Продуктов в холодильниках', value: stats?.totalFridgeItems ?? 0, icon: '❄️' },
    { label: 'Сохранённых рецептов', value: stats?.totalSavedRecipes ?? 0, icon: '🍳' },
  ];

  return (
    <div className="bg-background">
      <TopBar title="EatSave Admin" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => {
            const clickable = c.label === 'Всего пользователей';
            return (
              <button
                key={c.label}
                type="button"
                disabled={!clickable || allLoading}
                onClick={clickable ? () => load(true) : undefined}
                className={`bg-surface border border-border rounded-xl p-3 text-left ${clickable ? 'active:opacity-70' : ''}`}
              >
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="text-2xl font-bold text-accent">{c.value}</div>
                <div className="text-xs text-muted mt-1">{c.label}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">
              {showAll ? `Все пользователи (${recentUsers.length})` : 'Последние пользователи'}
            </h2>
            {!showAll && (
              <button
                type="button"
                disabled={allLoading}
                onClick={() => load(true)}
                className="text-accent text-xs underline"
              >
                {allLoading ? 'Загрузка…' : 'Показать всех'}
              </button>
            )}
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-muted">Пока никого нет</p>
          ) : (
            <ul className={`space-y-2 ${showAll ? 'max-h-[70vh] overflow-y-auto' : ''}`}>
              {recentUsers.map((u) => (
                <li
                  key={u.telegram_user_id}
                  className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-foreground font-medium truncate">
                      {userDisplayLabel(u)}
                    </div>
                    {u.first_name && u.username && (
                      <div className="text-muted text-xs truncate">@{u.username.replace(/^@/, '')}</div>
                    )}
                    {u.is_premium && (
                      <span className="text-xs">
                        ⭐ Premium
                        {u.premium_until && (
                          <> до {new Date(u.premium_until).toLocaleDateString('ru-RU')}</>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted text-right flex flex-col items-end gap-1">
                    <div className="font-mono">{u.telegram_user_id}</div>
                    <div>{new Date(u.created_at).toLocaleDateString('ru-RU')}</div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[9rem]">
                      <button
                        type="button"
                        disabled={grantBusy === u.telegram_user_id}
                        onClick={() => grantPremium(u.telegram_user_id, 15, Boolean(u.is_premium), 'set')}
                        className="text-accent text-[10px] border border-accent/30 rounded px-2 py-0.5"
                      >
                        {grantBusy === u.telegram_user_id ? '…' : '15д'}
                      </button>
                      <button
                        type="button"
                        disabled={grantBusy === u.telegram_user_id}
                        onClick={() => grantPremium(u.telegram_user_id, 30, Boolean(u.is_premium), 'set')}
                        className="text-accent text-[10px] border border-accent/30 rounded px-2 py-0.5"
                      >
                        {grantBusy === u.telegram_user_id ? '…' : '30д'}
                      </button>
                      {u.is_premium && (
                        <>
                          <button
                            type="button"
                            disabled={grantBusy === u.telegram_user_id}
                            onClick={() => grantPremium(u.telegram_user_id, 15, true, 'extend')}
                            className="text-muted text-[10px] border border-border rounded px-2 py-0.5"
                          >
                            +15
                          </button>
                          <button
                            type="button"
                            disabled={grantBusy === u.telegram_user_id}
                            onClick={() => grantPremium(u.telegram_user_id, 30, true, 'extend')}
                            className="text-muted text-[10px] border border-border rounded px-2 py-0.5"
                          >
                            +30
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => load(showAll)}
          className="w-full py-3 rounded-xl bg-accent text-background font-semibold"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { userDisplayLabel } from '@/lib/sync-user-profile';
import { useDataAuth } from '@/lib/use-data-auth';
import { useTelegram } from '@/components/TelegramProvider';

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
  created_at: string;
};

export default function AdminPage() {
  const auth = useDataAuth();
  const { user, loading: tgLoading } = useTelegram();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [status, setStatus] = useState<'loading' | 'forbidden' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [grantBusy, setGrantBusy] = useState<number | null>(null);

  const grantPremium = async (telegramUserId: number, days: 15 | 30) => {
    if (!auth) return;
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

  const load = useCallback(async () => {
    if (!auth) return;
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: auth.initData, telegram_user_id: auth.telegram_user_id }),
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
    } catch {
      setStatus('error');
      setError('Network error');
    }
  }, [auth]);

  useEffect(() => {
    if (!tgLoading && auth) load();
  }, [tgLoading, auth, load]);

  if (tgLoading || (auth && status === 'loading')) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <TopBar title="Admin" />
        <div className="p-4 text-muted text-center">Загрузка…</div>
      </div>
    );
  }

  if (!auth || !user) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <TopBar title="Admin" />
        <div className="p-4 text-center text-muted">Откройте страницу через Telegram Mini App.</div>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen bg-background pb-24">
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
      <div className="min-h-screen bg-background pb-24">
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
    <div className="min-h-screen bg-background pb-24">
      <TopBar title="EatSave Admin" />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="bg-surface border border-border rounded-xl p-3">
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-2xl font-bold text-accent">{c.value}</div>
              <div className="text-xs text-muted mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-xl p-4">
          <h2 className="font-semibold text-foreground mb-3">Последние пользователи</h2>
          {recentUsers.length === 0 ? (
            <p className="text-sm text-muted">Пока никого нет</p>
          ) : (
            <ul className="space-y-2">
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
                    {u.is_premium && <span className="text-xs">⭐ Premium</span>}
                  </div>
                  <div className="text-xs text-muted text-right flex flex-col items-end gap-1">
                    <div className="font-mono">{u.telegram_user_id}</div>
                    <div>{new Date(u.created_at).toLocaleDateString('ru-RU')}</div>
                    {!u.is_premium && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={grantBusy === u.telegram_user_id}
                          onClick={() => grantPremium(u.telegram_user_id, 15)}
                          className="text-accent text-[10px] border border-accent/30 rounded px-2 py-0.5"
                        >
                          {grantBusy === u.telegram_user_id ? '…' : '⭐ 15д'}
                        </button>
                        <button
                          type="button"
                          disabled={grantBusy === u.telegram_user_id}
                          onClick={() => grantPremium(u.telegram_user_id, 30)}
                          className="text-accent text-[10px] border border-accent/30 rounded px-2 py-0.5"
                        >
                          {grantBusy === u.telegram_user_id ? '…' : '⭐ 30д'}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          className="w-full py-3 rounded-xl bg-accent text-background font-semibold"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}

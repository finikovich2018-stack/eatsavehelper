'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';
import { PREMIUM_PRICE_STARS } from '@/lib/constants';

type UserProfile = {
  is_premium?: boolean;
  premium_until?: string | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸', AUD: 'A$', CAD: 'C$',
};

type Stats = {
  fridgeCount: number;
  byCurrency: Record<string, number>;
  receiptCount: number;
  recipeCount: number;
  daysUnderBudget: number;
};

export default function ProfilePage() {
  const { user } = useTelegram();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({
    fridgeCount: 0,
    byCurrency: {},
    receiptCount: 0,
    recipeCount: 0,
    daysUnderBudget: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return null;

    const res = await fetch('/api/user/get-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_user_id: user.id }),
    });
    const data = await res.json();
    if (data.user) setUserProfile(data.user);
    return data.user as UserProfile | null;
  }, [user?.id]);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { count: fridgeCount } = await supabase
        .from('fridge_items')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', user.id);

      const { count: receiptCount } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', user.id);

      const { count: recipeCount } = await supabase
        .from('saved_recipes')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', user.id);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount, currency, date')
        .eq('telegram_user_id', user.id)
        .gte('date', monthStart);

      const byCurrency: Record<string, number> = {};
      expensesData?.forEach((e) => {
        const cur = (e as { currency?: string }).currency || 'RUB';
        byCurrency[cur] = (byCurrency[cur] || 0) + (Number(e.amount) || 0);
      });

      const { data: budgetRow } = await supabase
        .from('budgets')
        .select('amount')
        .eq('telegram_user_id', user.id)
        .eq('month', monthStart)
        .eq('currency', 'RUB')
        .maybeSingle();

      const limit = Number(budgetRow?.amount || 15000);
      const spent = byCurrency['RUB'] || 0;
      const daysInMonth = now.getDate();
      const daysUnderBudget = spent <= limit ? daysInMonth : 0;

      setStats({
        fridgeCount: fridgeCount || 0,
        byCurrency,
        receiptCount: receiptCount || 0,
        recipeCount: recipeCount || 0,
        daysUnderBudget,
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUserProfile();
    loadStats();
  }, [loadUserProfile, loadStats]);

  const isPremium = Boolean(userProfile?.is_premium);

  const monthName = new Date().toLocaleString('ru-RU', { month: 'long' });

  const achievements = [
    {
      icon: '💰',
      title: 'Без перерасхода',
      desc: '7 дней в бюджете',
      unlocked: stats.daysUnderBudget >= 7,
    },
    {
      icon: '🧾',
      title: 'Первый чек',
      desc: 'Отсканировать чек',
      unlocked: stats.receiptCount >= 1,
    },
    {
      icon: '👨‍🍳',
      title: 'Шеф-повар',
      desc: '10 AI рецептов',
      unlocked: stats.recipeCount >= 10,
    },
    {
      icon: '🌱',
      title: 'Экономист',
      desc: 'Сэкономить 2000₽',
      unlocked: (15000 - (stats.byCurrency['RUB'] || 0)) >= 2000,
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="👤 Профиль" />
      <div className="max-w-mobile mx-auto px-4 py-8 space-y-8">

        {/* Карточка профиля */}
        <div className="bg-gradient-to-br from-surface/80 to-background border border-accent/20 rounded-3xl p-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -mr-24 -mt-24 pointer-events-none" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="text-6xl">👤</div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground leading-tight">{user?.first_name || 'Пользователь'}</h1>
                  {user?.username && (
                    <p className="text-accent font-medium mt-1">@{user.username}</p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                {isPremium ? (
                  <div className="bg-accent/20 rounded-2xl px-5 py-3 border border-accent/50 text-center">
                    <span className="text-accent font-bold text-sm block">⭐ Premium</span>
                    <span className="text-xs text-muted mt-1 block">активен</span>
                  </div>
                ) : (
                  <div className="bg-surface border border-border rounded-2xl px-5 py-3 text-center">
                    <span className="text-muted text-sm block font-medium">Стандартный</span>
                    <span className="text-xs text-muted/70 mt-1 block">план</span>
                  </div>
                )}
              </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-accent/40 to-accent/0 rounded-full" />
          </div>
        </div>

        {/* Статистика */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <span>📊</span> Статистика
          </h2>
          {loading ? (
            <p className="text-muted text-sm">Загрузка...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-border rounded-2xl p-5 text-center hover:border-accent/50 transition-colors group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">❄️</div>
                <div className="text-3xl font-bold text-accent mb-1">{stats.fridgeCount}</div>
                <div className="text-sm text-muted">продуктов</div>
                <div className="text-xs text-muted/60 mt-2">в холодильнике</div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5 text-center hover:border-accent/50 transition-colors group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">💰</div>
                {Object.keys(stats.byCurrency).length === 0 ? (
                  <div className="text-3xl font-bold text-accent mb-1">0 ₽</div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(stats.byCurrency).map(([cur, amount]) => {
                      const sym = CURRENCY_SYMBOLS[cur] || cur;
                      return (
                        <div key={cur} className="text-xl font-bold text-accent">
                          {cur === 'RUB' ? amount.toLocaleString() : amount.toFixed(2)} {sym}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-sm text-muted mt-1">потрачено</div>
                <div className="text-xs text-muted/60 mt-1">в {monthName}</div>
              </div>
            </div>
          )}
        </div>

        {/* Достижения */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <span>🏆</span> Достижения
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((a) => (
              <div
                key={a.title}
                className={`rounded-2xl p-4 border text-center transition ${
                  a.unlocked
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-surface border-border opacity-50'
                }`}
              >
                <div className="text-3xl mb-2">{a.icon}</div>
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs text-muted mt-1">{a.desc}</div>
                {a.unlocked && (
                  <span className="inline-block mt-2 text-xs text-accent font-medium">✓ Получено</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Информация */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <span>ℹ️</span> Информация
          </h3>
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <span className="text-muted">ID Telegram</span>
              <span className="font-mono text-sm text-accent font-semibold">{user?.id}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-muted">Версия EatSave</span>
              <span className="text-sm text-foreground font-medium">v1.0.0</span>
            </div>
          </div>
        </div>

        {/* Кнопка Premium */}
        {!isPremium && (
          <button
            onClick={async (event) => {
              const button = event.currentTarget;
              button.disabled = true;

              try {
                const res = await fetch('/api/create-premium-invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: user?.id }),
                });

                const data = await res.json();

                if (data.invoiceLink) {
                  const tg = (window as { Telegram?: { WebApp: { openInvoice: (link: string, cb: (status: string) => void) => void } } }).Telegram?.WebApp;
                  tg?.openInvoice(data.invoiceLink, async (status: string) => {
                    if (status === 'paid') {
                      for (let i = 0; i < 5; i++) {
                        await new Promise((r) => setTimeout(r, 1000));
                        const profile = await loadUserProfile();
                        if (profile?.is_premium) break;
                      }
                      alert('✅ Спасибо! Premium активирован.');
                      window.location.reload();
                    } else if (status === 'cancelled') {
                      alert('Оплата отменена');
                    } else if (status === 'failed') {
                      alert('Ошибка оплаты. Попробуйте ещё раз.');
                    }
                  });
                } else {
                  alert(data.error || 'Ошибка при создании счёта');
                }
              } catch {
                alert('Не удалось создать счёт');
              } finally {
                button.disabled = false;
              }
            }}
            className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-background font-bold py-4 rounded-2xl transition-all duration-200 active:scale-95 shadow-lg shadow-accent/30 disabled:opacity-60"
          >
            <span className="flex items-center justify-center gap-2">
              <span>⭐</span> Купить Premium — {PREMIUM_PRICE_STARS} Stars/мес
            </span>
          </button>
        )}

        {isPremium && userProfile?.premium_until && (
          <p className="text-center text-sm text-muted">
            Подписка активна до{' '}
            {new Date(userProfile.premium_until).toLocaleDateString('ru-RU')}
          </p>
        )}

        {/* Описание */}
        <div className="bg-surface/60 border border-accent/10 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            <span className="text-accent font-semibold">🎯 Что такое EatSave?</span>
          </p>
          <p className="text-sm text-muted/80 leading-relaxed">
            EatSave помогает вам эффективно управлять холодильником, отслеживать сроки годности продуктов и контролировать расходы на продукты.
          </p>
        </div>

      </div>
    </main>
  );
}

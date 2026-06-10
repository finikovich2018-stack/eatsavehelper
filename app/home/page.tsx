'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';
import Link from 'next/link';

type Stats = {
  fridgeCount: number;
  monthlySpent: number;
  expiringCount: number;
};

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function HomePage() {
  const { user } = useTelegram();
  const [stats, setStats] = useState<Stats>({ fridgeCount: 0, monthlySpent: 0, expiringCount: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: fridgeData, count: fridgeCount } = await supabase
        .from('fridge_items')
        .select('expiry_date', { count: 'exact' })
        .eq('telegram_user_id', user.id);

      const expiringCount = fridgeData?.filter(item => {
        const days = daysLeft(item.expiry_date);
        return days <= 3 && days > 0;
      }).length || 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('telegram_user_id', user.id)
        .gte('date', monthStart);

      const totalSpent = expensesData?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      setStats({
        fridgeCount: fridgeCount || 0,
        monthlySpent: totalSpent,
        expiringCount,
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hour = new Date().getHours();
  let greeting = 'Добрый день';
  if (hour < 12) greeting = 'Доброе утро';
  else if (hour < 18) greeting = 'Добрый день';
  else greeting = 'Добрый вечер';

  const monthName = new Date().toLocaleString('ru-RU', { month: 'long' });

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="EatSave" />
      <div className="max-w-mobile mx-auto px-4 py-8 space-y-8">
        
        {/* Приветствие */}
        <div className="space-y-3 pt-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-4xl font-bold">{greeting}</h1>
            <span className="text-4xl font-bold text-accent">{user?.first_name || 'Друг'}</span>
          </div>
          <p className="text-muted text-base">Управляйте холодильником и контролируйте расходы</p>
        </div>

        {/* Статистика */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-surface to-background/80 rounded-3xl p-6 border border-accent/20">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <div className="text-muted text-sm font-medium">🥬 Продуктов</div>
                <div className="text-5xl font-bold text-accent">{stats.fridgeCount}</div>
                <div className="text-xs text-muted/60">в холодильнике</div>
              </div>
              <div className="space-y-2">
                <div className="text-muted text-sm font-medium">💰 Потрачено</div>
                <div className="text-4xl font-bold text-accent">{stats.monthlySpent.toLocaleString()}</div>
                <div className="text-xs text-muted/60">в {monthName}</div>
              </div>
            </div>

            {stats.expiringCount > 0 && (
              <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-2xl">⏰</span>
                <div className="flex-1">
                  <div className="font-semibold text-yellow-100 text-sm">
                    {stats.expiringCount} продуктов скоро истекают
                  </div>
                  <div className="text-xs text-yellow-100/70 mt-1">Проверьте рецепты и используйте их</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-2xl p-4 text-center">
              <div className="text-3xl mb-2">🥬</div>
              <div className="text-xl font-bold">{stats.fridgeCount}</div>
              <div className="text-xs text-muted mt-2">продуктов</div>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4 text-center">
              <div className="text-3xl mb-2">💸</div>
              <div className="text-xl font-bold text-accent">{(stats.monthlySpent / 1000).toFixed(1)}K</div>
              <div className="text-xs text-muted mt-2">рублей</div>
            </div>
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <span>⚡</span> Быстрые действия
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/fridge" className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95">
              <div className="text-4xl mb-2">🥬</div>
              <div className="font-semibold text-sm">Холодильник</div>
            </Link>
            <Link href="/budget" className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95">
              <div className="text-4xl mb-2">💰</div>
              <div className="font-semibold text-sm">Бюджет</div>
            </Link>
            <Link href="/recipes" className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95">
              <div className="text-4xl mb-2">👨‍🍳</div>
              <div className="font-semibold text-sm">Рецепты</div>
            </Link>
            <Link href="/scan" className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95">
              <div className="text-4xl mb-2">📷</div>
              <div className="font-semibold text-sm">Сканер</div>
            </Link>
          </div>
        </div>

        {/* Советы */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <span className="text-2xl">💡</span> Полезные советы
          </h3>
          
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-emerald-950 to-zinc-900 border border-emerald-700/50 rounded-3xl p-5">
              <div className="flex gap-4">
                <div className="text-4xl">🥶</div>
                <div className="flex-1">
                  <p className="font-medium text-emerald-100">Проверяйте холодильник <span className="text-emerald-400">каждый день</span></p>
                  <p className="text-sm text-zinc-400 mt-1">Чтобы не забыть про продукты и вовремя их использовать.</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-950 to-zinc-900 border border-amber-700/50 rounded-3xl p-5">
              <div className="flex gap-4">
                <div className="text-4xl">📖</div>
                <div className="flex-1">
                  <p className="font-medium text-amber-100">Используйте <span className="text-amber-400">рецепты</span></p>
                  <p className="text-sm text-zinc-400 mt-1">Чтобы готовить из продуктов, которые вот-вот испортятся.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
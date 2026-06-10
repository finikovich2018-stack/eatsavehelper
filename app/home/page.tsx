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
      // Загружаем количество продуктов в холодильнике и истекающих
      const { data: fridgeData, count: fridgeCount } = await supabase
        .from('fridge_items')
        .select('expiry_date', { count: 'exact' })
        .eq('telegram_user_id', user.id);

      // Считаем истекающие продукты
      const expiringCount = fridgeData?.filter(item => {
        const days = daysLeft(item.expiry_date);
        return days <= 3 && days > 0;
      }).length || 0;

      // Загружаем траты за текущий месяц
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

  const monthName = new Date().toLocaleString('ru-RU', { month: 'long' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Добрый утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="EatSave" />
      <div className="max-w-mobile mx-auto px-4 py-8 space-y-8">
        
        {/* Приветствие с улучшенной визуализацией */}
        <div className="space-y-3 pt-2">
          <div className="flex items-baseline gap-2">
            <h1 className="text-4xl font-bold">
              {greeting}
            </h1>
            <span className="text-4xl font-bold text-accent">{user?.first_name || 'Друг'}</span>
          </div>
          <p className="text-muted text-base">Управляйте холодильником и контролируйте расходы</p>
        </div>

        {/* Основная статистика - улучшенная версия */}
        <div className="space-y-6">
          {/* Карточка с основными метриками */}
          <div className="bg-gradient-to-br from-surface to-background/80 rounded-3xl p-6 border border-accent/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-full -mr-20 -mt-20 pointer-events-none" />
            <div className="relative z-10">
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
              
              {/* Предупреждение об истекающих продуктах */}
              {stats.expiringCount > 0 && (
                <div className="bg-yellow-500/15 border border-yellow-500/40 rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm">
                  <span className="text-2xl flex-shrink-0">⏰</span>
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-100 text-sm">{stats.expiringCount} продуктов скоро истекают</div>
                    <div className="text-xs text-yellow-100/70 mt-1">Проверьте рецепты и используйте их</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Статистика по метрикам */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-2xl p-4 text-center hover:border-accent/50 transition-colors">
              <div className="text-3xl mb-2">🥬</div>
              <div className="text-xl font-bold text-foreground">{stats.fridgeCount}</div>
              <div className="text-xs text-muted mt-2">продуктов</div>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-4 text-center hover:border-accent/50 transition-colors">
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
            <Link
              href="/fridge"
              className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-accent/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="relative z-10 space-y-2">
                <div className="text-4xl">🥬</div>
                <div className="font-semibold text-foreground text-sm">Холодильник</div>
              </div>
            </Link>
            <Link
              href="/budget"
              className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-accent/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="relative z-10 space-y-2">
                <div className="text-4xl">💰</div>
                <div className="font-semibold text-foreground text-sm">Бюджет</div>
              </div>
            </Link>
            <Link
              href="/recipes"
              className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-accent/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="relative z-10 space-y-2">
                <div className="text-4xl">👨‍🍳</div>
                <div className="font-semibold text-foreground text-sm">Рецепты</div>
              </div>
            </Link>
            <Link
              href="/scan"
              className="group bg-surface hover:bg-surface/80 border border-border hover:border-accent/50 rounded-2xl p-5 text-center transition-all active:scale-95 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-accent/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              <div className="relative z-10 space-y-2">
                <div className="text-4xl">📷</div>
                <div className="font-semibold text-foreground text-sm">Сканер</div>
              </div>
            </Link>
          </div>
        </div>

        {/* Советы и рекомендации */}
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <span>💡</span> Советы
          </h3>
          <div className="space-y-2">
            <div className="bg-surface/60 border border-accent/10 rounded-2xl p-4 backdrop-blur-sm hover:border-accent/30 transition-colors">
              <p className="text-sm text-muted">
                Проверяйте холодильник <span className="text-accent font-semibold">каждый день</span>, чтобы не забыть про продукты.
              </p>
            </div>
            <div className="bg-surface/60 border border-accent/10 rounded-2xl p-4 backdrop-blur-sm hover:border-accent/30 transition-colors">
              <p className="text-sm text-muted">
                Используйте <span className="text-accent font-semibold">рецепты</span> чтобы готовить из продуктов, которые вот-вот испортятся.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

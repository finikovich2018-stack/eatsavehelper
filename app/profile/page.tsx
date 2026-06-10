'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';

type Stats = {
  fridgeCount: number;
  monthlySpent: number;
};

export default function ProfilePage() {
  const { user } = useTelegram();
  const [stats, setStats] = useState<Stats>({ fridgeCount: 0, monthlySpent: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      // Загружаем количество продуктов в холодильнике
      const { data: fridgeData, count: fridgeCount } = await supabase
        .from('fridge_items')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', user.id);

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

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="👤 Профиль" />
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Карточка профиля */}
        <div className="bg-gradient-to-br from-accent/20 to-surface rounded-3xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-5xl mb-3">👋</div>
              <h2 className="text-2xl font-bold">{user?.first_name || 'Пользователь'}</h2>
              {user?.username && <p className="text-muted text-sm mt-1">@{user.username}</p>}
            </div>
            <div className="text-right">
              {user?.is_premium ? (
                <div className="bg-accent/30 rounded-2xl px-4 py-2 border border-accent">
                  <span className="text-accent font-medium">⭐ Premium</span>
                </div>
              ) : (
                <div className="bg-surface rounded-2xl px-4 py-2 border border-border">
                  <span className="text-muted text-sm">Стандартный план</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-2xl p-4 border border-border text-center">
            <div className="text-3xl font-bold text-accent mb-2">{stats.fridgeCount}</div>
            <div className="text-sm text-muted">Продуктов в холодильнике</div>
          </div>
          <div className="bg-surface rounded-2xl p-4 border border-border text-center">
            <div className="text-3xl font-bold text-accent mb-2">{stats.monthlySpent.toLocaleString()}</div>
            <div className="text-sm text-muted">Потрачено в {monthName}</div>
          </div>
        </div>

        {/* Дополнительная статистика */}
        <div className="bg-surface rounded-2xl p-5 border border-border space-y-4">
          <h3 className="font-semibold text-foreground">Активность</h3>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-muted">ID пользователя</span>
            <span className="font-mono text-sm text-foreground">{user?.id}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-muted">Приложение</span>
            <span className="font-medium text-foreground">v1.0</span>
          </div>
        </div>

        {/* Кнопка Premium */}
        {!user?.is_premium && (
          <button
            onClick={() => alert('🚀 Premium скоро доступен!')}
            className="w-full bg-accent hover:bg-accent/90 text-background font-bold py-4 rounded-2xl transition-all duration-200 active:scale-95"
          >
            ⭐ Перейти в Premium
          </button>
        )}

        {/* Информационная карточка */}
        <div className="bg-surface/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs text-muted leading-relaxed">
            💡 <span className="text-foreground">EatSave</span> помогает управлять холодильником и контролировать расходы. Добавляйте продукты, отслеживайте их срок годности и ведите учёт расходов.
          </p>
        </div>
      </div>
    </main>
  );
}

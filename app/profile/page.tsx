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
                {user?.is_premium ? (
                  <div className="bg-accent/20 rounded-2xl px-5 py-3 border border-accent/50 text-center">
                    <span className="text-accent font-bold text-sm block">⭐ Premium</span>
                    <span className="text-xs text-muted mt-1 block">активен</span>
                  </div>
                ) : (
                  <div className="bg-surface border border-border rounded-2xl px-5 py-3 text-center hover:border-accent/30 transition-colors">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-2xl p-5 text-center hover:border-accent/50 transition-colors group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🥬</div>
              <div className="text-3xl font-bold text-accent mb-1">{stats.fridgeCount}</div>
              <div className="text-sm text-muted">продуктов</div>
              <div className="text-xs text-muted/60 mt-2">в холодильнике</div>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5 text-center hover:border-accent/50 transition-colors group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">💰</div>
              <div className="text-3xl font-bold text-accent mb-1">{(stats.monthlySpent / 1000).toFixed(1)}K</div>
              <div className="text-sm text-muted">потрачено</div>
              <div className="text-xs text-muted/60 mt-2">в {monthName}</div>
            </div>
          </div>
        </div>

        {/* Детальная информация */}
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
        {!user?.is_premium && (
          <button
            onClick={() => alert('🚀 Функция Premium скоро будет доступна!')}
            className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-background font-bold py-4 rounded-2xl transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl shadow-accent/30"
          >
            <span className="flex items-center justify-center gap-2">
              <span>⭐</span> Перейти в Premium
            </span>
          </button>
        )}

        {/* Описание приложения */}
        <div className="bg-surface/60 border border-accent/10 rounded-2xl p-5 backdrop-blur-sm hover:border-accent/30 transition-colors space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            <span className="text-accent font-semibold">🎯 Что такое EatSave?</span>
          </p>
          <p className="text-sm text-muted/80 leading-relaxed">
            EatSave помогает вам эффективно управлять холодильником, отслеживать сроки годности продуктов и контролировать расходы на продукты. Добавляйте покупки, получайте напоминания об истекающих продуктах и планируйте блюда на основе того, что у вас есть.
          </p>
        </div>

        {/* Подсказка */}
        <div className="bg-surface/40 border border-border/50 rounded-2xl p-4">
          <p className="text-xs text-muted text-center leading-relaxed">
            💡 Нажмите на «Холодильник» чтобы начать добавлять свои продукты
          </p>
        </div>
      </div>
    </main>
  );
}

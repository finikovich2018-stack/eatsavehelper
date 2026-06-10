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
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="EatSave" />
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {/* Приветствие */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            {greeting}, <span className="text-green-400">{user?.first_name || 'Друг'}</span>!
          </h1>
          <p className="text-zinc-400">Давайте управлять вашим холодильником и расходами</p>
        </div>

        {/* Основная статистика */}
        <div className="bg-gradient-to-br from-green-500/10 to-zinc-900 rounded-3xl p-6 border border-green-500/30">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-zinc-400 text-sm mb-1">Продуктов</div>
              <div className="text-4xl font-bold text-green-400">{stats.fridgeCount}</div>
            </div>
            <div>
              <div className="text-zinc-400 text-sm mb-1">Потрачено</div>
              <div className="text-4xl font-bold text-green-400">{stats.monthlySpent.toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-1">в {monthName}</div>
            </div>
          </div>
          
          {stats.expiringCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-3">
              <span className="text-2xl">⏰</span>
              <div className="flex-1">
                <div className="font-medium text-yellow-400">{stats.expiringCount} продуктов скоро истекают</div>
                <div className="text-xs text-zinc-400">Используйте их в рецептах</div>
              </div>
            </div>
          )}
        </div>

        {/* Быстрые действия */}
        <div>
          <h2 className="font-semibold text-white mb-3">⚡ Быстрые действия</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/fridge"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-4 text-center transition-all active:scale-95"
            >
              <div className="text-4xl mb-2">🥬</div>
              <div className="font-medium text-white text-sm">Холодильник</div>
            </Link>
            <Link
              href="/budget"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-4 text-center transition-all active:scale-95"
            >
              <div className="text-4xl mb-2">💰</div>
              <div className="font-medium text-white text-sm">Бюджет</div>
            </Link>
            <Link
              href="/recipes"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-4 text-center transition-all active:scale-95"
            >
              <div className="text-4xl mb-2">👨‍🍳</div>
              <div className="font-medium text-white text-sm">Рецепты</div>
            </Link>
            <Link
              href="/scan"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-4 text-center transition-all active:scale-95"
            >
              <div className="text-4xl mb-2">📷</div>
              <div className="font-medium text-white text-sm">Сканер</div>
            </Link>
          </div>
        </div>

        {/* Подсказки */}
        <div className="space-y-3">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
            <p className="text-sm text-zinc-400">
              <span className="text-green-400 font-semibold">💡 Совет:</span> Проверяйте холодильник каждый день, чтобы ничего не выбросить!
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
            <p className="text-sm text-zinc-400">
              <span className="text-green-400 font-semibold">🎯 Цель:</span> Старайтесь использовать продукты до истечения срока годности.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

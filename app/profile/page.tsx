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
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="👤 Профиль" />
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Карточка профиля */}
        <div className="bg-gradient-to-br from-green-500/20 to-zinc-900 rounded-3xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-5xl mb-3">👋</div>
              <h2 className="text-2xl font-bold">{user?.first_name || 'Пользователь'}</h2>
              {user?.username && <p className="text-zinc-400 text-sm mt-1">@{user.username}</p>}
            </div>
            <div className="text-right">
              {user?.is_premium ? (
                <div className="bg-green-500/30 rounded-2xl px-4 py-2 border border-green-500">
                  <span className="text-green-400 font-medium">⭐ Premium</span>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-2xl px-4 py-2 border border-zinc-800">
                  <span className="text-zinc-400 text-sm">Стандартный план</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">{stats.fridgeCount}</div>
            <div className="text-sm text-zinc-400">Продуктов в холодильнике</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">{stats.monthlySpent.toLocaleString()}</div>
            <div className="text-sm text-zinc-400">Потрачено в {monthName}</div>
          </div>
        </div>

        {/* Дополнительная статистика */}
        <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 space-y-4">
          <h3 className="font-semibold text-white">Активность</h3>
          <div className="flex items-center justify-between py-2 border-t border-zinc-800">
            <span className="text-zinc-400">ID пользователя</span>
            <span className="font-mono text-sm text-white">{user?.id}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-zinc-800">
            <span className="text-zinc-400">Приложение</span>
            <span className="font-medium text-white">v1.0</span>
          </div>
        </div>

        {/* Кнопка Premium */}
        {!user?.is_premium && (
          <button
            onClick={() => alert('🚀 Premium скоро доступен!')}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-4 rounded-2xl transition-all duration-200 active:scale-95"
          >
            ⭐ Перейти в Premium
          </button>
        )}

        {/* Информационная карточка */}
        <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
          <p className="text-xs text-zinc-400 leading-relaxed">
            💡 <span className="text-white">EatSave</span> помогает управлять холодильником и контролировать расходы. Добавляйте продукты, отслеживайте их срок годности и ведите учёт расходов.
          </p>
        </div>
      </div>
    </main>
  );
}

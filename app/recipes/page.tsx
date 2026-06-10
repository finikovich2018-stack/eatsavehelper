'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';

type Recipe = {
  id: string;
  name: string;
  icon: string;
  time: string;
  ingredients: string[];
};

type FridgeItem = {
  id: string;
  name: string;
  expiry_date: string;
  quantity: string;
  category: string;
  icon: string;
};

const RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Борщ украинский',
    icon: '🍲',
    time: '45 мин',
    ingredients: ['Свёкла', 'Капуста', 'Морковь', 'Говядина', 'Сметана'],
  },
  {
    id: '2',
    name: 'Омлет с сыром',
    icon: '🍳',
    time: '15 мин',
    ingredients: ['Яйца', 'Молоко', 'Сыр', 'Масло', 'Соль'],
  },
  {
    id: '3',
    name: 'Овощной салат',
    icon: '🥗',
    time: '10 мин',
    ingredients: ['Помидоры', 'Огурцы', 'Салат', 'Масло', 'Уксус'],
  },
  {
    id: '4',
    name: 'Паста Карбонара',
    icon: '🍝',
    time: '20 мин',
    ingredients: ['Паста', 'Бекон', 'Яйца', 'Пармезан', 'Чёрный перец'],
  },
];

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function RecipesPage() {
  const { user } = useTelegram();
  const [expiringItems, setExpiringItems] = useState<FridgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [showAI, setShowAI] = useState(false);

  const loadExpiringItems = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from('fridge_items')
        .select('*')
        .eq('telegram_user_id', user.id)
        .order('expiry_date', { ascending: true });

      if (data) {
        const expiring = data.filter(item => {
          const days = daysLeft(item.expiry_date);
          return days <= 3 && days > 0;
        });
        setExpiringItems(expiring);
      }
    } catch (error) {
      console.error('Ошибка загрузки продуктов:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadExpiringItems();
  }, [loadExpiringItems]);

  if (selected) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white pb-24">
        <TopBar title={selected.name} />
        <div className="max-w-xl mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="text-7xl mb-4">{selected.icon}</div>
            <h1 className="text-2xl font-bold mb-2">{selected.name}</h1>
            <span className="inline-block bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
              ⏱ {selected.time}
            </span>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-5 mb-4 border border-zinc-800">
            <h2 className="font-semibold text-green-400 mb-4">📝 Ингредиенты</h2>
            <ul className="space-y-2">
              {selected.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-white">{ing}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-zinc-900/50 rounded-2xl p-5 mb-6 border border-zinc-800/50">
            <p className="text-sm text-zinc-400 leading-relaxed">
              💡 Рецепт готовится за <span className="text-green-400 font-semibold">{selected.time}</span>. Попробуйте приготовить это блюдо из продуктов в вашем холодильнике!
            </p>
          </div>

          <button
            onClick={() => setSelected(null)}
            className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-medium py-3 rounded-2xl transition-all"
          >
            ← Назад к рецептам
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="👨‍🍳 Рецепты" />
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {/* Кнопка AI рецептов */}
        <button
          onClick={() => setShowAI(true)}
          className="w-full bg-gradient-to-r from-green-500/30 to-green-500/10 hover:from-green-500/40 hover:to-green-500/20 border border-green-500 rounded-2xl p-5 text-left transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white mb-1">✨ Что приготовить?</h3>
              <p className="text-sm text-zinc-400">Получи рецепты подходящие твоим продуктам</p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </button>

        {/* Модальное окно AI */}
        {showAI && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-3xl p-6 max-w-sm w-full border border-zinc-800">
              <div className="text-center">
                <div className="text-5xl mb-4">🚀</div>
                <h2 className="text-2xl font-bold text-white mb-2">AI Рецепты</h2>
                <p className="text-zinc-400 mb-6">
                  Скоро здесь будут персональные рецепты на основе ваших продуктов, подготовленные искусственным интеллектом!
                </p>
                <button
                  onClick={() => setShowAI(false)}
                  className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3 rounded-2xl transition-all"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Продукты которые скоро истекают */}
        {expiringItems.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <h3 className="font-semibold text-white mb-4">⏰ Скоро истекают</h3>
            <div className="space-y-2">
              {expiringItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{item.name}</div>
                    <div className="text-xs text-zinc-400">{item.quantity}</div>
                  </div>
                  <span className="text-xs font-semibold text-yellow-400">
                    {daysLeft(item.expiry_date)} дн.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Список рецептов */}
        <div>
          <h3 className="font-semibold text-white mb-4">🥘 Популярные рецепты</h3>
          <div className="space-y-3">
            {RECIPES.map(recipe => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-4 flex items-center gap-4 text-left transition-all active:scale-95"
              >
                <span className="text-5xl">{recipe.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-white">{recipe.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {recipe.ingredients.slice(0, 3).join(', ')}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-green-400">
                    <span>⏱ {recipe.time}</span>
                  </div>
                </div>
                <span className="text-white/50">›</span>
              </button>
            ))}
          </div>
        </div>

        {/* Подсказка */}
        <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50">
          <p className="text-xs text-zinc-400 leading-relaxed">
            💡 <span className="text-white">Совет:</span> используйте продукты которые скоро истекают, чтобы ничего не выбросить!
          </p>
        </div>
      </div>
    </main>
  );
}
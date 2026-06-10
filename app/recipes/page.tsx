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
      <main className="min-h-screen bg-background text-foreground pb-24">
        <TopBar title={selected.name} />
        <div className="max-w-xl mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="text-7xl mb-4">{selected.icon}</div>
            <h1 className="text-2xl font-bold mb-2">{selected.name}</h1>
            <span className="inline-block bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium">
              ⏱ {selected.time}
            </span>
          </div>

          <div className="bg-surface rounded-2xl p-5 mb-4 border border-border">
            <h2 className="font-semibold text-accent mb-4">📝 Ингредиенты</h2>
            <ul className="space-y-2">
              {selected.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-accent">✓</span>
                  <span className="text-foreground">{ing}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface/50 rounded-2xl p-5 mb-6 border border-border/50">
            <p className="text-sm text-muted leading-relaxed">
              💡 Рецепт готовится за <span className="text-accent font-semibold">{selected.time}</span>. Попробуйте приготовить это блюдо из продуктов в вашем холодильнике!
            </p>
          </div>

          <button
            onClick={() => setSelected(null)}
            className="w-full bg-surface hover:bg-surface/80 border border-border text-foreground font-medium py-3 rounded-2xl transition-all"
          >
            ← Назад к рецептам
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="👨‍🍳 Рецепты" />
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {/* Кнопка AI рецептов */}
        <button
          onClick={() => setShowAI(true)}
          className="w-full bg-gradient-to-r from-accent/30 to-accent/10 hover:from-accent/40 hover:to-accent/20 border border-accent rounded-2xl p-5 text-left transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground mb-1">✨ Что приготовить?</h3>
              <p className="text-sm text-muted">Получи рецепты подходящие твоим продуктам</p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </button>

        {/* Модальное окно AI */}
        {showAI && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-3xl p-6 max-w-sm w-full border border-border">
              <div className="text-center">
                <div className="text-5xl mb-4">🚀</div>
                <h2 className="text-2xl font-bold text-foreground mb-2">AI Рецепты</h2>
                <p className="text-muted mb-6">
                  Скоро здесь будут персональные рецепты на основе ваших продуктов, подготовленные искусственным интеллектом!
                </p>
                <button
                  onClick={() => setShowAI(false)}
                  className="w-full bg-accent hover:bg-accent/90 text-background font-bold py-3 rounded-2xl transition-all"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Продукты которые скоро истекают */}
        {expiringItems.length > 0 && (
          <div className="bg-surface rounded-2xl p-5 border border-border">
            <h3 className="font-semibold text-foreground mb-4">⏰ Скоро истекают</h3>
            <div className="space-y-2">
              {expiringItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{item.name}</div>
                    <div className="text-xs text-muted">{item.quantity}</div>
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
          <h3 className="font-semibold text-foreground mb-4">🥘 Популярные рецепты</h3>
          <div className="space-y-3">
            {RECIPES.map(recipe => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="w-full bg-surface hover:bg-surface/80 border border-border rounded-2xl p-4 flex items-center gap-4 text-left transition-all active:scale-95"
              >
                <span className="text-5xl">{recipe.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{recipe.name}</div>
                  <div className="text-xs text-muted mt-1">
                    {recipe.ingredients.slice(0, 3).join(', ')}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-accent">
                    <span>⏱ {recipe.time}</span>
                  </div>
                </div>
                <span className="text-foreground/50">›</span>
              </button>
            ))}
          </div>
        </div>

        {/* Подсказка */}
        <div className="bg-surface/50 rounded-2xl p-4 border border-border/50">
          <p className="text-xs text-muted leading-relaxed">
            💡 <span className="text-foreground">Совет:</span> используйте продукты которые скоро истекают, чтобы ничего не выбросить!
          </p>
        </div>
      </div>
    </main>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';
import { FREE_AI_RECIPES_PER_MONTH } from '@/lib/constants';

type Recipe = {
  id: string;
  name: string;
  icon: string;
  time: string;
  ingredients: string[];
};

type SavedRecipe = {
  id: string;
  name: string;
  icon: string;
  ingredients: string[];
  steps: string[];
  created_at: string;
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
  { id: '1', name: 'Борщ украинский', icon: '🍲', time: '45 мин', ingredients: ['Свёкла', 'Капуста', 'Морковь', 'Говядина', 'Сметана'] },
  { id: '2', name: 'Омлет с сыром', icon: '🍳', time: '15 мин', ingredients: ['Яйца', 'Молоко', 'Сыр', 'Масло', 'Соль'] },
  { id: '3', name: 'Овощной салат', icon: '🥗', time: '10 мин', ingredients: ['Помидоры', 'Огурцы', 'Салат', 'Масло', 'Уксус'] },
  { id: '4', name: 'Паста Карбонара', icon: '🍝', time: '20 мин', ingredients: ['Паста', 'Бекон', 'Яйца', 'Пармезан', 'Чёрный перец'] },
];

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function RecipesPage() {
  const { user } = useTelegram();
  const [expiringItems, setExpiringItems] = useState<FridgeItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedRecipe | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      fetch('/api/user/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: user.id }),
      }).then((r) => r.json()).then((d) => setUserProfile(d.user));
    }
  }, [user?.id]);

  const getAIRecipes = async () => {
    if (!userProfile?.is_premium && (userProfile?.ai_recipes_this_month || 0) >= FREE_AI_RECIPES_PER_MONTH) {
      alert(`Бесплатный лимит: ${FREE_AI_RECIPES_PER_MONTH} AI рецепта/месяц. Купите Premium!`);
      return;
    }
    setShowAI(true);
    setAiLoading(true);
    try {
      const { data } = await supabase
        .from('fridge_items')
        .select('name')
        .eq('telegram_user_id', user?.id);

      const ingredients = (data || []).map((i: { name: string }) => i.name);
      if (ingredients.length === 0) {
        setAiLoading(false);
        return;
      }

      const res = await fetch('/api/ai/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          telegram_user_id: user?.id,
          is_premium: userProfile?.is_premium,
          save: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          alert(`Бесплатный лимит: ${FREE_AI_RECIPES_PER_MONTH} AI рецепта/месяц. Купите Premium!`);
          setAiLoading(false);
          return;
        }
        throw new Error(json.error || 'Ошибка');
      }
      setAiRecipes(json.recipes || []);

      await fetch('/api/user/increment-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: user?.id }),
      });
      setUserProfile((prev: any) =>
        prev ? { ...prev, ai_recipes_this_month: (prev.ai_recipes_this_month || 0) + 1 } : prev
      );
      loadSavedRecipes();
    } catch {
      /* ignore */
    } finally {
      setAiLoading(false);
    }
  };

  const loadSavedRecipes = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('saved_recipes')
      .select('*')
      .eq('telegram_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setSavedRecipes(data || []);
  }, [user?.id]);

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
        setExpiringItems(data.filter((item) => {
          const d = daysLeft(item.expiry_date);
          return d <= 3 && d > 0;
        }));
      }
      await loadSavedRecipes();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadSavedRecipes]);

  useEffect(() => {
    loadExpiringItems();
  }, [loadExpiringItems]);

  const aiLeft = userProfile?.is_premium
    ? '∞'
    : Math.max(0, FREE_AI_RECIPES_PER_MONTH - (userProfile?.ai_recipes_this_month || 0));

  if (selectedSaved) {
    const steps = Array.isArray(selectedSaved.steps) ? selectedSaved.steps : [];
    return (
      <main className="min-h-screen bg-background text-foreground pb-24">
        <TopBar title={selectedSaved.name} />
        <div className="max-w-mobile mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="text-7xl mb-4">{selectedSaved.icon}</div>
            <h1 className="text-2xl font-bold mb-2">{selectedSaved.name}</h1>
            <span className="inline-block bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium">
              ✨ AI рецепт
            </span>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-accent mb-4">📝 Ингредиенты</h2>
            <ul className="space-y-2">
              {(selectedSaved.ingredients || []).map((ing, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-accent">✓</span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>
          {steps.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
              <h2 className="font-semibold text-accent mb-4">👨‍🍳 Приготовление</h2>
              <p className="text-sm text-muted leading-relaxed">{steps.join('\n')}</p>
            </div>
          )}
          <button
            onClick={() => setSelectedSaved(null)}
            className="w-full bg-surface border border-border font-medium py-3 rounded-2xl"
          >
            ← Назад к рецептам
          </button>
        </div>
      </main>
    );
  }

  if (selected) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-24">
        <TopBar title={selected.name} />
        <div className="max-w-mobile mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="text-7xl mb-4">{selected.icon}</div>
            <h1 className="text-2xl font-bold mb-2">{selected.name}</h1>
            <span className="inline-block bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium">
              ⏱ {selected.time}
            </span>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-accent mb-4">📝 Ингредиенты</h2>
            <ul className="space-y-2">
              {selected.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="text-accent">✓</span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="w-full bg-surface border border-border font-medium py-3 rounded-2xl"
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
      <div className="max-w-mobile mx-auto px-4 py-6 space-y-6">
        <button
          onClick={getAIRecipes}
          className="w-full bg-gradient-to-r from-accent/30 to-accent/10 hover:from-accent/40 hover:to-accent/20 border border-accent rounded-2xl p-5 text-left transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">✨ Что приготовить?</h3>
              <p className="text-sm text-muted">
                {userProfile?.is_premium
                  ? '⭐ Premium — безлимитно'
                  : `Осталось: ${aiLeft}/${FREE_AI_RECIPES_PER_MONTH} в месяц`}
              </p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </button>

        {showAI && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto">
              {aiLoading ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🤖</div>
                  <p className="text-muted">Подбираю рецепты...</p>
                </div>
              ) : aiRecipes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">❄️</div>
                  <p className="text-muted">Добавьте продукты в холодильник</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">✨ Рецепты для вас</h2>
                  {aiRecipes.map((r, i) => (
                    <div key={i} className="bg-background border border-border rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xl">{r.icon}</span>
                        <div>
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-xs text-accent">⏱ {r.time}</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted mb-2">{r.steps}</p>
                      <div className="flex flex-wrap gap-1">
                        {r.usesFromFridge?.map((ing: string, j: number) => (
                          <span key={j} className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowAI(false)}
                className="w-full mt-4 bg-background border border-border py-3 rounded-2xl"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}

        {savedRecipes.length > 0 && (
          <div>
            <h3 className="font-semibold mb-4">💾 Сохранённые рецепты</h3>
            <div className="space-y-3">
              {savedRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedSaved(recipe)}
                  className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition"
                >
                  <span className="text-4xl">{recipe.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{recipe.name}</div>
                    <div className="text-xs text-muted mt-1">
                      {(recipe.ingredients || []).slice(0, 3).join(', ')}
                    </div>
                  </div>
                  <span className="text-muted">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {expiringItems.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="font-semibold mb-4">⏰ Скоро истекают</h3>
            <div className="space-y-2">
              {expiringItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
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

        <div>
          <h3 className="font-semibold mb-4">🥘 Популярные рецепты</h3>
          <div className="space-y-3">
            {RECIPES.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition"
              >
                <span className="text-5xl">{recipe.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{recipe.name}</div>
                  <div className="text-xs text-muted mt-1">
                    {recipe.ingredients.slice(0, 3).join(', ')}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-accent">
                    <span>⏱ {recipe.time}</span>
                  </div>
                </div>
                <span className="text-muted">›</span>
              </button>
            ))}
          </div>
        </div>

        {!loading && (
          <div className="bg-surface/60 border border-accent/10 rounded-2xl p-4">
            <p className="text-xs text-muted leading-relaxed">
              💡 <span className="text-foreground">Совет:</span> используйте продукты которые скоро истекают!
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

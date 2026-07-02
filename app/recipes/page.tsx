'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import TopBar from '@/components/layout/TopBar';
import { dataApi } from '@/lib/client-api';
import { useAuthReady, useReleaseLoadingWhenUnauthenticated } from '@/lib/use-data-auth';
import { useTelegram } from '@/components/TelegramProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { FREE_AI_RECIPES_PER_MONTH } from '@/lib/constants';
import { findMissingIngredients } from '@/lib/shopping-utils';
import { hasPremiumAccess, isPremiumActive } from '@/lib/user-utils';
import { readSessionCache, writeSessionCache } from '@/lib/session-cache';
import type { Locale } from '@/lib/i18n/translations';

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

const RECIPES_RU: Recipe[] = [
  { id: '1', name: 'Борщ украинский', icon: '🍲', time: '45 мин', ingredients: ['Свёкла', 'Капуста', 'Морковь', 'Говядина', 'Сметана'] },
  { id: '2', name: 'Омлет с сыром', icon: '🍳', time: '15 мин', ingredients: ['Яйца', 'Молоко', 'Сыр', 'Масло', 'Соль'] },
  { id: '3', name: 'Овощной салат', icon: '🥗', time: '10 мин', ingredients: ['Помидоры', 'Огурцы', 'Салат', 'Масло', 'Уксус'] },
  { id: '4', name: 'Паста Карбонара', icon: '🍝', time: '20 мин', ingredients: ['Паста', 'Бекон', 'Яйца', 'Пармезан', 'Чёрный перец'] },
];

const RECIPES_EN: Recipe[] = [
  { id: '1', name: 'Ukrainian Borscht', icon: '🍲', time: '45 min', ingredients: ['Beetroot', 'Cabbage', 'Carrot', 'Beef', 'Sour cream'] },
  { id: '2', name: 'Cheese Omelette', icon: '🍳', time: '15 min', ingredients: ['Eggs', 'Milk', 'Cheese', 'Butter', 'Salt'] },
  { id: '3', name: 'Vegetable Salad', icon: '🥗', time: '10 min', ingredients: ['Tomatoes', 'Cucumbers', 'Lettuce', 'Oil', 'Vinegar'] },
  { id: '4', name: 'Pasta Carbonara', icon: '🍝', time: '20 min', ingredients: ['Pasta', 'Bacon', 'Eggs', 'Parmesan', 'Black pepper'] },
];

const RECIPES_BY_LOCALE: Record<Locale, Recipe[]> = {
  ru: RECIPES_RU,
  en: RECIPES_EN,
};

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

const RECIPES_CACHE_KEY = 'eatsave:recipes';
type RecipesCache = { expiringItems: FridgeItem[]; savedRecipes: SavedRecipe[] };

export default function RecipesPage() {
  const { auth, ready } = useAuthReady();
  const { user, dbUser, initData, refreshUser } = useTelegram();
  const { t, locale } = useI18n();
  const [aiMode, setAiMode] = useState<'fridge' | 'budget'>('fridge');
  const recipes = useMemo(() => RECIPES_BY_LOCALE[locale], [locale]);
  const [expiringItems, setExpiringItems] = useState<FridgeItem[]>(
    () => readSessionCache<RecipesCache>(RECIPES_CACHE_KEY)?.expiringItems ?? []
  );
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(
    () => readSessionCache<RecipesCache>(RECIPES_CACHE_KEY)?.savedRecipes ?? []
  );
  const [loading, setLoading] = useState(
    () => !readSessionCache<RecipesCache>(RECIPES_CACHE_KEY)
  );
  useReleaseLoadingWhenUnauthenticated(ready, auth, setLoading);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedRecipe | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [aiRecipes, setAiRecipes] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    refreshUser().then((profile) => {
      if (profile) setUserProfile(profile);
    });
  }, [refreshUser]);

  const isPremium = hasPremiumAccess(userProfile || dbUser || {});

  const getAIRecipes = async (
    opts: { preferExpiring?: boolean; budget?: boolean } = {}
  ) => {
    const { preferExpiring = false, budget = false } = opts;
    if (!auth) return;
    if (!isPremium && (userProfile?.ai_recipes_this_month || 0) >= FREE_AI_RECIPES_PER_MONTH) {
      alert(t('recipes.limitAlert', { limit: FREE_AI_RECIPES_PER_MONTH }));
      return;
    }
    setAiMode(budget ? 'budget' : 'fridge');
    setShowAI(true);
    setAiLoading(true);
    try {
      const { items } = await dataApi.fridge.list(auth);
      const all = (items || []) as FridgeItem[];
      let source = all;
      if (preferExpiring) {
        const soon = all.filter((i) => i.expiry_date && daysLeft(i.expiry_date) <= 3);
        if (soon.length > 0) source = soon;
      }
      const ingredients = source.map((i) => i.name);
      if (ingredients.length === 0) {
        setAiLoading(false);
        return;
      }

      const res = await fetch('/api/ai/suggest-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients,
          initData,
          telegram_user_id: user?.id,
          save: true,
          mode: budget ? 'budget' : 'fridge',
          locale,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          alert(t('recipes.limitAlert', { limit: FREE_AI_RECIPES_PER_MONTH }));
          setAiLoading(false);
          return;
        }
        throw new Error(json.error || t('common.error'));
      }
      setAiRecipes(json.recipes || []);

      await fetch('/api/user/increment-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, telegram_user_id: user?.id }),
      });
      setUserProfile((prev: any) =>
        prev ? { ...prev, ai_recipes_this_month: (prev.ai_recipes_this_month || 0) + 1 } : prev
      );
      loadSavedRecipes();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      alert(message);
    } finally {
      setAiLoading(false);
    }
  };

  const loadSavedRecipes = useCallback(async () => {
    if (!auth) return;
    const { items } = await dataApi.recipes.list(auth);
    setSavedRecipes((items || []) as SavedRecipe[]);
  }, [auth]);

  const deleteSavedRecipe = async (id: string) => {
    if (!auth) return;
    if (!confirm(t('recipes.deleteConfirm'))) return;

    await dataApi.recipes.delete(auth, id);

    setSavedRecipes((prev) => prev.filter((r) => r.id !== id));
    if (selectedSaved?.id === id) setSelectedSaved(null);
  };

  const loadExpiringItems = useCallback(async () => {
    if (!auth) return;
    try {
      const { items } = await dataApi.fridge.list(auth);
      const data = (items || []) as FridgeItem[];
      setExpiringItems(data.filter((item) => {
        const d = daysLeft(item.expiry_date);
        return d <= 3 && d > 0;
      }));
      await loadSavedRecipes();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [auth, loadSavedRecipes]);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadExpiringItems();
  }, [ready, auth, loadExpiringItems]);

  useEffect(() => {
    if (!loading) {
      writeSessionCache<RecipesCache>(RECIPES_CACHE_KEY, { expiringItems, savedRecipes });
    }
  }, [expiringItems, savedRecipes, loading]);

  // Deep link from the daily reminder: "🍳 Что приготовить" opens /recipes?cook=expiring
  // and immediately generates an AI recipe focused on soon-to-expire products.
  const cookTriggered = useRef(false);
  useEffect(() => {
    if (!auth || cookTriggered.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('cook') === 'expiring') {
      cookTriggered.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      getAIRecipes({ preferExpiring: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const aiLeft = isPremium
    ? '∞'
    : Math.max(0, FREE_AI_RECIPES_PER_MONTH - (userProfile?.ai_recipes_this_month || 0));

  const addMissingToShoppingList = async (ingredients: string[]) => {
    if (!auth) return;
    try {
      const { items } = await dataApi.fridge.list(auth);
      const fridgeNames = ((items || []) as FridgeItem[]).map((i) => i.name);
      const missing = findMissingIngredients(ingredients, fridgeNames);
      if (missing.length === 0) {
        alert(t('recipes.allInFridge'));
        return;
      }
      await dataApi.shopping.insert(
        auth,
        missing.map((name) => ({ name, source: 'recipe' }))
      );
      alert(t('recipes.addedMissing', { count: missing.length }));
    } catch {
      alert(t('common.networkError'));
    }
  };

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
              {t('recipes.aiRecipe')}
            </span>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-accent mb-4">{t('recipes.ingredients')}</h2>
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
              <h2 className="font-semibold text-accent mb-4">{t('recipes.steps')}</h2>
              <p className="text-sm text-muted leading-relaxed">{steps.join('\n')}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => addMissingToShoppingList(selectedSaved.ingredients || [])}
            className="w-full bg-accent/10 border border-accent/40 text-accent font-medium py-3 rounded-2xl mb-3"
          >
            {t('recipes.addMissingToList')}
          </button>
          <button
            onClick={() => deleteSavedRecipe(selectedSaved.id)}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium py-3 rounded-2xl mb-3"
          >
            🗑 {t('recipes.delete')}
          </button>
          <button
            onClick={() => setSelectedSaved(null)}
            className="w-full bg-surface border border-border font-medium py-3 rounded-2xl"
          >
            {t('common.back')}
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
            <h2 className="font-semibold text-accent mb-4">{t('recipes.ingredients')}</h2>
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
            type="button"
            onClick={() => addMissingToShoppingList(selected.ingredients)}
            className="w-full bg-accent/10 border border-accent/40 text-accent font-medium py-3 rounded-2xl mb-4"
          >
            {t('recipes.addMissingToList')}
          </button>
          <button
            onClick={() => setSelected(null)}
            className="w-full bg-surface border border-border font-medium py-3 rounded-2xl"
          >
            {t('common.back')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('recipes.title')} />
      <div className="max-w-mobile mx-auto px-4 py-6 space-y-6">
        <button
          onClick={() => getAIRecipes()}
          className="w-full bg-gradient-to-r from-accent/30 to-accent/10 hover:from-accent/40 hover:to-accent/20 border border-accent rounded-2xl p-5 text-left transition-all glow-pulse anim-rise-in"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">{t('recipes.whatToCook')}</h3>
              <p className="text-sm text-muted">
                {isPremium
                  ? t('recipes.premiumUnlimited')
                  : t('recipes.aiLeft', { left: aiLeft, limit: FREE_AI_RECIPES_PER_MONTH })}
              </p>
            </div>
            <span className="text-2xl arrow-nudge">→</span>
          </div>
        </button>

        <button
          onClick={() => getAIRecipes({ budget: true })}
          className="w-full bg-gradient-to-r from-surface to-accent/5 hover:from-surface hover:to-accent/10 border border-accent/50 rounded-2xl p-4 text-left transition-all glow-pulse anim-rise-in anim-delay-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('recipes.budgetTitle')}</h3>
              <p className="text-sm text-muted">{t('recipes.budgetDesc')}</p>
            </div>
            <span className="text-2xl home-action-icon home-action-icon-2">💸</span>
          </div>
        </button>

        {showAI && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto">
              {aiLoading ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4 float-soft inline-block">🤖</div>
                  <p className="text-muted">{t('recipes.picking')}</p>
                </div>
              ) : aiRecipes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4 float-soft inline-block">❄️</div>
                  <p className="text-muted">{t('recipes.addProducts')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">
                    {aiMode === 'budget' ? t('recipes.budgetTitle') : t('recipes.forYou')}
                  </h2>
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
                {t('common.close')}
              </button>
            </div>
          </div>
        )}

        {savedRecipes.length > 0 && (
          <div className="anim-rise-in anim-delay-2">
            <h3 className="font-semibold mb-4">{t('recipes.saved')}</h3>
            <div className="space-y-3">
              {savedRecipes.map((recipe, i) => (
                <div
                  key={recipe.id}
                  className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 anim-rise-in"
                  style={{ animationDelay: `${0.06 + i * 0.05}s` }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSaved(recipe)}
                    className="flex flex-1 items-center gap-4 text-left active:scale-[0.98] transition min-w-0"
                  >
                    <span className="text-4xl shrink-0 home-action-icon" style={{ animationDelay: `${i * 0.25}s` }}>
                      {recipe.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{recipe.name}</div>
                      <div className="text-xs text-muted mt-1 truncate">
                        {(recipe.ingredients || []).slice(0, 3).join(', ')}
                      </div>
                    </div>
                    <span className="text-muted shrink-0">›</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedRecipe(recipe.id)}
                    className="text-muted hover:text-red-400 text-xl px-2 shrink-0"
                    aria-label={t('recipes.delete')}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {expiringItems.length > 0 && (
          <button
            type="button"
            onClick={() => getAIRecipes({ preferExpiring: true })}
            className="w-full bg-surface border border-yellow-400/40 rounded-2xl p-5 text-left active:scale-[0.99] transition glow-pulse anim-rise-in anim-delay-3"
          >
            <h3 className="font-semibold mb-4">{t('recipes.expiringSoon')}</h3>
            <div className="space-y-2">
              {expiringItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-2xl home-action-icon" style={{ animationDelay: `${daysLeft(item.expiry_date) * 0.2}s` }}>
                    {item.icon}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted">{item.quantity}</div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${daysLeft(item.expiry_date) <= 1 ? 'text-red-400 home-urgent-badge' : 'text-yellow-400'}`}
                  >
                    {t('common.days', { n: daysLeft(item.expiry_date) })}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-accent font-medium mt-4 text-center">
              🍳 {t('recipes.cookFromExpiring')}
            </p>
          </button>
        )}

        <div className="anim-rise-in anim-delay-4">
          <h3 className="font-semibold mb-4">{t('recipes.popular')}</h3>
          <div className="space-y-3">
            {recipes.map((recipe, i) => (
              <button
                key={recipe.id}
                onClick={() => setSelected(recipe)}
                className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition anim-rise-in"
                style={{ animationDelay: `${0.08 + i * 0.06}s` }}
              >
                <span className="text-5xl home-action-icon" style={{ animationDelay: `${i * 0.3}s` }}>
                  {recipe.icon}
                </span>
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
              {t('recipes.tip')}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

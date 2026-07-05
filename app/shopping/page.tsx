'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { dataApi, type ApiShoppingItem } from '@/lib/client-api';
import { useAuthReady, useReleaseLoadingWhenUnauthenticated, useLoadingTimeout } from '@/lib/use-data-auth';
import { useTelegram } from '@/components/TelegramProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { FREE_FRIDGE_ITEMS } from '@/lib/constants';
import { defaultExpiryDate } from '@/lib/shopping-utils';
import { hasPremiumAccess } from '@/lib/user-utils';
import { readSessionCache, writeSessionCache, userCacheKey } from '@/lib/session-cache';
import { runMutation } from '@/lib/run-mutation';
import Spinner from '@/components/ui/Spinner';

const SUGGEST_ICONS: Record<string, string> = {
  dairy: '🥛', meat: '🍗', veg: '🥦', grains: '🌾', other: '📦',
};

const SHOPPING_CACHE_BASE = 'eatsave:shopping';
type SuggestionRow = { name: string; category: string | null; count: number };
type ShoppingCache = { items: ApiShoppingItem[]; suggestions: SuggestionRow[] };

export default function ShoppingPage() {
  const { auth, ready } = useAuthReady();
  const { dbUser, refreshUser } = useTelegram();
  const { t } = useI18n();
  const cacheKey = auth ? userCacheKey(SHOPPING_CACHE_BASE, auth.telegram_user_id) : null;
  const [items, setItems] = useState<ApiShoppingItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  useReleaseLoadingWhenUnauthenticated(ready, auth, setLoading);
  useLoadingTimeout(loading, setLoading);

  useEffect(() => {
    if (!cacheKey) return;
    const cached = readSessionCache<ShoppingCache>(cacheKey);
    if (!cached) return;
    setItems(cached.items ?? []);
    setSuggestions(cached.suggestions ?? []);
    setLoading(false);
  }, [cacheKey]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', quantity: '' });
  const [localUser, setLocalUser] = useState<typeof dbUser>(null);
  const isPremium = hasPremiumAccess(localUser || dbUser || {});

  useEffect(() => {
    refreshUser().then(setLocalUser);
  }, [refreshUser]);

  const loadItems = useCallback(async () => {
    if (!auth) return;
    try {
      const { items: rows } = await dataApi.shopping.list(auth);
      setItems(rows || []);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const loadSuggestions = useCallback(async () => {
    if (!auth) return;
    try {
      const { suggestions: rows } = await dataApi.shopping.suggestions(auth);
      setSuggestions(rows || []);
    } catch {
      setSuggestions([]);
    }
  }, [auth]);

  useEffect(() => {
    if (!ready || !auth) return;
    void loadItems();
    void loadSuggestions();
  }, [ready, auth, loadItems, loadSuggestions]);

  useEffect(() => {
    if (!auth || !cacheKey || loading) return;
    writeSessionCache<ShoppingCache>(cacheKey, { items, suggestions });
  }, [auth, cacheKey, items, suggestions, loading]);

  const pending = useMemo(() => items.filter((i) => !i.checked), [items]);
  const bought = useMemo(() => items.filter((i) => i.checked), [items]);

  const onMutationError = (message: string) => {
    alert(message || t('common.networkError'));
  };

  async function addItem() {
    if (!form.name.trim() || !auth) return;
    const name = form.name.trim();
    const quantity = form.quantity.trim() || undefined;
    await runMutation(async () => {
      const { items: inserted } = await dataApi.shopping.insert(auth, [
        { name, quantity, source: 'manual' },
      ]);
      const row = (inserted || [])[0];
      if (row) {
        setItems((prev) => {
          const without = prev.filter((p) => p.id !== row.id);
          return [row, ...without];
        });
      }
      setForm({ name: '', quantity: '' });
      setShowForm(false);
    }, onMutationError, t('common.networkError'));
  }

  async function addSuggestion(name: string) {
    if (!auth) return;
    await runMutation(async () => {
      setSuggestions((prev) => prev.filter((s) => s.name !== name));
      const { items: inserted } = await dataApi.shopping.insert(auth, [
        { name, source: 'suggested' },
      ]);
      const row = (inserted || [])[0];
      if (row) {
        setItems((prev) => {
          const without = prev.filter((p) => p.id !== row.id);
          return [row, ...without];
        });
      }
    }, onMutationError, t('common.networkError'));
  }

  async function toggleItem(item: ApiShoppingItem) {
    if (!auth) return;
    await runMutation(async () => {
      const { item: updated } = await dataApi.shopping.toggle(auth, item.id, !item.checked);
      if (updated) {
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }
    }, onMutationError, t('common.networkError'));
  }

  async function removeItem(id: string) {
    if (!auth) return;
    await runMutation(async () => {
      await dataApi.shopping.delete(auth, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, onMutationError, t('common.networkError'));
  }

  async function clearBought() {
    if (!auth || bought.length === 0) return;
    await runMutation(async () => {
      await dataApi.shopping.clearChecked(auth);
      setItems((prev) => prev.filter((i) => !i.checked));
    }, onMutationError, t('common.networkError'));
  }

  async function moveToFridge(item: ApiShoppingItem) {
    if (!auth) return;
    try {
      if (!isPremium) {
        const { count } = await dataApi.fridge.count(auth);
        if ((count || 0) >= FREE_FRIDGE_ITEMS) {
          alert(t('fridge.limitAlert', { limit: FREE_FRIDGE_ITEMS }));
          return;
        }
      }
      await dataApi.fridge.insert(auth, [{
        name: item.name,
        quantity: item.quantity || '',
        expiry_date: defaultExpiryDate(7),
        category: 'other',
        icon: '📦',
      }]);
      await dataApi.shopping.delete(auth, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      alert(t('shopping.addedToFridge'));
    } catch {
      alert(t('common.networkError'));
    }
  }

  return (
    <main className="bg-background text-foreground">
      <TopBar title={t('shopping.title')} />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="flex gap-3 mb-4 anim-rise-in">
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex-1 bg-accent text-background py-3 rounded-2xl font-medium glow-pulse"
          >
            {t('shopping.add')}
          </button>
        </div>

        {!loading && pending.length > 0 && (
          <p className="text-xs text-muted mb-4 text-center">
            {t('shopping.itemsCount', { count: pending.length })}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="mb-5 anim-rise-in anim-delay-1">
            <div className="text-xs text-muted mb-1.5">💡 {t('shopping.suggestTitle')}</div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => addSuggestion(s.name)}
                  className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-accent/40 text-foreground active:scale-95 transition"
                >
                  {SUGGEST_ICONS[s.category || 'other'] || '📦'} {s.name}
                  <span className="text-accent ml-1">✨</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <input
              placeholder={t('shopping.itemName')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder={t('shopping.quantity')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
            <button
              type="button"
              onClick={addItem}
              className="w-full bg-accent text-background py-3 rounded-xl font-medium"
            >
              {t('common.save')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted">
            <Spinner className="w-6 h-6 border-muted/30 border-t-accent" />
            <span>{t('common.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted py-20">
            <div className="text-5xl mb-4 float-soft inline-block">🛒</div>
            <div>{t('shopping.empty')}</div>
            <div className="text-sm mt-2">{t('shopping.emptyHint')}</div>
          </div>
        ) : (
          <div className="space-y-6">
            {pending.length > 0 && (
              <section>
                <h2 className="font-semibold text-sm text-muted mb-3">{t('shopping.toBuy')}</h2>
                <div className="space-y-2">
                  {pending.map((item, i) => (
                    <div
                      key={item.id}
                      className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 anim-rise-in"
                      style={{ animationDelay: `${0.06 + i * 0.05}s` }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        className="w-7 h-7 rounded-full border-2 border-accent shrink-0"
                        aria-label={t('shopping.bought')}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.name}</div>
                        {item.quantity && (
                          <div className="text-xs text-muted mt-0.5">{item.quantity}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-muted hover:text-red-400 px-2 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {bought.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-muted">{t('shopping.bought')}</h2>
                  <button
                    type="button"
                    onClick={clearBought}
                    className="text-xs text-accent font-medium"
                  >
                    {t('shopping.clearBought')}
                  </button>
                </div>
                <div className="space-y-2">
                  {bought.map((item) => (
                    <div
                      key={item.id}
                      className="bg-surface/60 border border-border/60 rounded-2xl p-4 flex items-center gap-3 opacity-80"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        className="w-7 h-7 rounded-full bg-accent text-background text-sm shrink-0 flex items-center justify-center"
                      >
                        ✓
                      </button>
                      <div className="flex-1 min-w-0 line-through text-muted">
                        <div>{item.name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => moveToFridge(item)}
                        className="text-xs text-accent font-medium shrink-0 px-2 py-1 border border-accent/30 rounded-lg"
                      >
                        {t('shopping.toFridge')}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

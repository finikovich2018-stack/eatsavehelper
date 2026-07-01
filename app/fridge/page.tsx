'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import { dataApi } from '@/lib/client-api';
import { useDataAuth } from '@/lib/use-data-auth';
import { useTelegram } from '@/components/TelegramProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { FREE_FRIDGE_ITEMS } from '@/lib/constants';
import { isPremiumActive, hasPremiumAccess } from '@/lib/user-utils';
import { formatLocalDate } from '@/lib/utils';
import type { TranslationKey } from '@/lib/i18n/translations';

const CATEGORY_KEYS = ['all', 'dairy', 'meat', 'veg', 'grains', 'other'] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CAT_I18N: Record<CategoryKey, TranslationKey> = {
  all: 'cat.all',
  dairy: 'cat.dairy',
  meat: 'cat.meat',
  veg: 'cat.veg',
  grains: 'cat.grains',
  other: 'cat.other',
};

type Item = {
  id: string;
  name: string;
  category: CategoryKey;
  expiry_date: string;
  quantity: string;
  icon: string;
};

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function expiryColor(days: number) {
  if (days <= 1) return 'text-red-400';
  if (days <= 3) return 'text-yellow-400';
  return 'text-accent';
}

const ICONS: Record<string, string> = {
  dairy: '🥛', meat: '🍗', veg: '🥦', grains: '🌾', other: '📦',
};

// Common products for 1-tap adding, with a sensible default shelf life (days).
const QUICK_TEMPLATES: {
  key: TranslationKey;
  icon: string;
  category: CategoryKey;
  days: number;
}[] = [
  { key: 'tmpl.milk', icon: '🥛', category: 'dairy', days: 7 },
  { key: 'tmpl.bread', icon: '🍞', category: 'grains', days: 4 },
  { key: 'tmpl.eggs', icon: '🥚', category: 'dairy', days: 21 },
  { key: 'tmpl.cheese', icon: '🧀', category: 'dairy', days: 14 },
  { key: 'tmpl.chicken', icon: '🍗', category: 'meat', days: 3 },
  { key: 'tmpl.tomato', icon: '🍅', category: 'veg', days: 7 },
  { key: 'tmpl.banana', icon: '🍌', category: 'veg', days: 5 },
  { key: 'tmpl.yogurt', icon: '🥛', category: 'dairy', days: 10 },
];

function expiryFromDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export default function FridgePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-foreground pb-24">
          <div className="text-center text-muted py-20">...</div>
        </main>
      }
    >
      <FridgePageContent />
    </Suspense>
  );
}

function FridgePageContent() {
  const searchParams = useSearchParams();
  const expiringOnly = searchParams.get('filter') === 'expiring';
  const auth = useDataAuth();
  const { dbUser, refreshUser } = useTelegram();
  const { t, dateLocale } = useI18n();
  const [localUser, setLocalUser] = useState<typeof dbUser>(null);
  const isPremium = hasPremiumAccess(localUser || dbUser || {});

  useEffect(() => {
    refreshUser().then(setLocalUser);
  }, [refreshUser]);
  const [items, setItems] = useState<Item[]>([]);
  const [consumeStats, setConsumeStats] = useState<{
    eaten: number;
    wasted: number;
    wasteFreeDays: number;
  } | null>(null);
  type HistoryItem = {
    id: string;
    name: string | null;
    category: string | null;
    action: 'eaten' | 'wasted';
    logged_at: string;
  };
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'eaten' | 'wasted'>('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');
  const [form, setForm] = useState({
    name: '', category: 'other' as CategoryKey, expiry_date: '', quantity: '',
  });

  const loadItems = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const { items } = await dataApi.fridge.list(auth);
      setItems((items || []) as Item[]);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const loadStats = useCallback(async () => {
    if (!auth) return;
    try {
      const { eaten, wasted, wasteFreeDays, available } = await dataApi.fridge.stats(auth);
      setConsumeStats(available ? { eaten, wasted, wasteFreeDays } : null);
    } catch {
      setConsumeStats(null);
    }
  }, [auth]);

  useEffect(() => {
    loadItems();
    loadStats();
  }, [loadItems, loadStats]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const days = daysLeft(item.expiry_date);
      const matchesExpiring = !expiringOnly || (days >= 0 && days <= 3);
      return matchesSearch && matchesCategory && matchesExpiring;
    });
  }, [items, search, categoryFilter, expiringOnly]);

  const atFridgeLimit = !isPremium && items.length >= FREE_FRIDGE_ITEMS;

  async function addItem() {
    if (!form.name || !form.expiry_date || !auth) return;
    if (atFridgeLimit) {
      alert(t('fridge.limitAlert', { limit: FREE_FRIDGE_ITEMS }));
      return;
    }
    const { items: inserted } = await dataApi.fridge.insert(auth, [{
      name: form.name,
      category: form.category === 'all' ? 'other' : form.category,
      quantity: form.quantity,
      expiry_date: form.expiry_date,
      icon: ICONS[form.category] || '📦',
    }]);
    const data = (inserted || [])[0] as Item | undefined;
    if (data) setItems([...items, data]);
    setForm({ name: '', category: 'other', expiry_date: '', quantity: '' });
    setShowForm(false);
  }

  async function openHistory() {
    if (!auth) return;
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const { items } = await dataApi.fridge.history(auth);
      setHistory((items || []) as HistoryItem[]);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function quickAddTemplate(tmpl: (typeof QUICK_TEMPLATES)[number]) {
    if (!auth) return;
    if (atFridgeLimit) {
      alert(t('fridge.limitAlert', { limit: FREE_FRIDGE_ITEMS }));
      return;
    }
    const { items: inserted } = await dataApi.fridge.insert(auth, [{
      name: t(tmpl.key),
      category: tmpl.category,
      quantity: '',
      expiry_date: expiryFromDays(tmpl.days),
      icon: tmpl.icon,
    }]);
    const data = (inserted || [])[0] as Item | undefined;
    if (data) setItems((prev) => [...prev, data]);
  }

  async function consumeItem(id: string, action: 'eaten' | 'wasted') {
    if (!auth) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConsumeStats((prev) => {
      const base = prev ?? { eaten: 0, wasted: 0, wasteFreeDays: 0 };
      return action === 'eaten'
        ? { ...base, eaten: base.eaten + 1 }
        : { ...base, wasted: base.wasted + 1, wasteFreeDays: 0 };
    });
    try {
      await dataApi.fridge.consume(auth, id, action);
    } catch {
      loadItems();
      loadStats();
    }
  }

  async function addToShoppingList(item: Item, removeFromFridge = false) {
    if (!auth) return;
    try {
      await dataApi.shopping.insert(auth, [{
        name: item.name,
        quantity: item.quantity,
        source: 'fridge',
        fridge_item_id: item.id,
      }]);
      if (removeFromFridge) {
        await dataApi.fridge.delete(auth, item.id);
        setItems(items.filter((i) => i.id !== item.id));
      } else {
        alert(t('fridge.addedToList'));
      }
    } catch {
      alert(t('common.networkError'));
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('fridge.title')} />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={atFridgeLimit}
            className="bg-accent text-background py-3 rounded-2xl font-medium disabled:opacity-50 text-sm"
          >
            {t('fridge.add')}
          </button>
          <Link
            href="/scan"
            className="bg-surface border border-border py-3 rounded-2xl font-medium text-center active:scale-[0.98] transition text-sm"
          >
            {t('fridge.scanReceipt')}
          </Link>
          <Link
            href="/shopping"
            className="bg-surface border border-accent/40 py-3 rounded-2xl font-medium text-center active:scale-[0.98] transition text-sm text-accent"
          >
            🛒 {t('nav.shopping')}
          </Link>
        </div>

        {!isPremium && (
          <p className="text-xs text-muted mb-4 text-center">
            {t('fridge.productsCount', { count: items.length, limit: FREE_FRIDGE_ITEMS })}
            {atFridgeLimit && <span className="text-yellow-400">{t('fridge.limitReached')}</span>}
          </p>
        )}

        <input
          placeholder={t('fridge.search')}
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 placeholder-muted outline-none mb-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mb-3">
          <div className="text-xs text-muted mb-1.5">{t('tmpl.title')}</div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.key}
                type="button"
                onClick={() => quickAddTemplate(tmpl)}
                disabled={atFridgeLimit}
                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border text-foreground active:scale-95 transition disabled:opacity-40"
              >
                {tmpl.icon} {t(tmpl.key)}
              </button>
            ))}
          </div>
        </div>

        {expiringOnly && (
          <div className="flex items-center justify-between mb-3 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3 py-2">
            <span className="text-sm text-yellow-400">{t('fridge.expiringFilter')}</span>
            <Link href="/fridge" className="text-xs text-accent font-medium">
              {t('fridge.showAll')}
            </Link>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition ${
                categoryFilter === key
                  ? 'bg-accent text-background'
                  : 'bg-surface border border-border text-muted'
              }`}
            >
              {t(CAT_I18N[key])}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <input
              placeholder={t('fridge.productName')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as CategoryKey })}
            >
              {CATEGORY_KEYS.filter((k) => k !== 'all').map((k) => (
                <option key={k} value={k}>{t(CAT_I18N[k])}</option>
              ))}
            </select>
            <input
              placeholder={t('fridge.quantity')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
            <input
              type="date"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
              value={form.expiry_date}
              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
            />
            <button
              onClick={addItem}
              className="w-full bg-accent text-background py-3 rounded-xl font-medium"
            >
              {t('common.save')}
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-accent">{items.length}</div>
            <div className="text-xs text-muted mt-1">{t('fridge.statsProducts')}</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              {items.filter((i) => daysLeft(i.expiry_date) <= 1).length}
            </div>
            <div className="text-xs text-muted mt-1">{t('fridge.statsExpiring')}</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {items.filter((i) => daysLeft(i.expiry_date) <= 3 && daysLeft(i.expiry_date) > 1).length}
            </div>
            <div className="text-xs text-muted mt-1">{t('fridge.statsSoon')}</div>
          </div>
        </div>

        {consumeStats && consumeStats.eaten + consumeStats.wasted > 0 && (
          <button
            type="button"
            onClick={openHistory}
            className="w-full bg-surface border border-border rounded-2xl px-4 py-3 mb-6 flex items-center justify-around text-center active:scale-[0.99] transition"
          >
            <div>
              <div className="text-lg font-bold text-accent">🍽 {consumeStats.eaten}</div>
              <div className="text-xs text-muted mt-0.5">{t('fridge.statEaten')}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="text-lg font-bold text-red-400">🗑 {consumeStats.wasted}</div>
              <div className="text-xs text-muted mt-0.5">{t('fridge.statWasted')}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-xs text-muted self-center">{t('fridge.consumeMonth')} ›</div>
          </button>
        )}

        {consumeStats && consumeStats.wasteFreeDays > 0 && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl px-4 py-2.5 mb-6 text-center text-sm font-medium text-accent">
            {t('fridge.wasteFree', { n: consumeStats.wasteFreeDays })}
          </div>
        )}

        {showHistory && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-3xl p-5 max-w-sm w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{t('fridge.historyTitle')}</h2>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="text-muted text-xl px-2"
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                {(['all', 'eaten', 'wasted'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHistoryFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      historyFilter === f
                        ? 'bg-accent text-background'
                        : 'bg-background border border-border text-muted'
                    }`}
                  >
                    {f === 'all' ? t('cat.all') : f === 'eaten' ? t('fridge.statEaten') : t('fridge.statWasted')}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto flex-1 -mx-1 px-1">
                {historyLoading ? (
                  <div className="text-center text-muted py-10">{t('common.loading')}</div>
                ) : (
                  (() => {
                    const filtered = history.filter(
                      (h) => historyFilter === 'all' || h.action === historyFilter
                    );
                    if (filtered.length === 0) {
                      return <div className="text-center text-muted py-10">{t('fridge.historyEmpty')}</div>;
                    }
                    return (
                      <div className="space-y-2">
                        {filtered.map((h) => (
                          <div
                            key={h.id}
                            className="flex items-center gap-3 bg-background border border-border rounded-xl px-3 py-2"
                          >
                            <span className="text-xl">{ICONS[h.category || 'other'] || '📦'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{h.name || '—'}</div>
                              <div className="text-[11px] text-muted">
                                {new Date(h.logged_at).toLocaleDateString(dateLocale)}
                              </div>
                            </div>
                            <span className={`text-xs font-medium ${h.action === 'eaten' ? 'text-accent' : 'text-red-400'}`}>
                              {h.action === 'eaten' ? `🍽 ${t('fridge.statEaten')}` : `🗑 ${t('fridge.statWasted')}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted py-10">{t('common.loading')}</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-muted py-20">
            <div className="text-5xl mb-4">❄️</div>
            <div>{items.length === 0 ? t('fridge.empty') : t('fridge.notFound')}</div>
            <div className="text-sm mt-2">
              {items.length === 0 ? t('fridge.emptyHint') : t('fridge.filterHint')}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const days = daysLeft(item.expiry_date);
              const catKey = item.category in CAT_I18N ? item.category : 'other';
              return (
                <div key={item.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {item.quantity} · {t(CAT_I18N[catKey])}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${expiryColor(days)}`}>
                      {days <= 0
                        ? t('fridge.expired')
                        : days === 1
                          ? t('fridge.expiresToday')
                          : t('fridge.daysLeft', { n: days })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => consumeItem(item.id, 'eaten')}
                        className="text-xs font-medium px-2 py-1 rounded-lg bg-accent/15 text-accent border border-accent/30 active:scale-95 transition"
                      >
                        🍽 {t('fridge.ate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => consumeItem(item.id, 'wasted')}
                        title={t('fridge.wasted')}
                        aria-label={t('fridge.wasted')}
                        className="text-xs font-medium px-2 py-1 rounded-lg bg-red-400/10 text-red-400 border border-red-400/30 active:scale-95 transition"
                      >
                        🗑
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addToShoppingList(item)}
                        className="text-xs text-accent font-medium px-2 py-1 border border-accent/30 rounded-lg"
                      >
                        🛒
                      </button>
                      <button
                        type="button"
                        onClick={() => addToShoppingList(item, true)}
                        className="text-[10px] text-muted px-1"
                      >
                        {t('fridge.outOfStock')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

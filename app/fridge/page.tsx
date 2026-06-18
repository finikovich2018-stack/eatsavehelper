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
import { isPremiumActive } from '@/lib/user-utils';
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
  const { t } = useI18n();
  const [localUser, setLocalUser] = useState<typeof dbUser>(null);
  const isPremium = isPremiumActive(localUser || dbUser || {});

  useEffect(() => {
    refreshUser().then(setLocalUser);
  }, [refreshUser]);
  const [items, setItems] = useState<Item[]>([]);
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

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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

  async function removeItem(id: string) {
    if (!auth) return;
    await dataApi.fridge.delete(auth, id);
    setItems(items.filter((i) => i.id !== id));
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('fridge.title')} />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={atFridgeLimit}
            className="bg-accent text-background py-3 rounded-2xl font-medium disabled:opacity-50"
          >
            {t('fridge.add')}
          </button>
          <Link
            href="/scan"
            className="bg-surface border border-border py-3 rounded-2xl font-medium text-center active:scale-[0.98] transition"
          >
            {t('fridge.scanReceipt')}
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
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-muted hover:text-red-400 text-xl px-2"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

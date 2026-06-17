'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';
import { FREE_FRIDGE_ITEMS } from '@/lib/constants';

const CATEGORIES = {
  all: '📦 Все',
  dairy: '🥛 Молочное',
  meat: '🥩 Мясо',
  veg: '🥦 Овощи',
  grains: '🌾 Крупы',
  other: '📦 Другое',
} as const;

type CategoryKey = keyof typeof CATEGORIES;

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
  const { user, dbUser } = useTelegram();
  const testUserId = user?.id;
  const isPremium = Boolean(dbUser?.is_premium);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');
  const [form, setForm] = useState({
    name: '', category: 'other' as CategoryKey, expiry_date: '', quantity: '',
  });

  const loadItems = useCallback(async () => {
    if (!testUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from('fridge_items')
      .select('*')
      .eq('telegram_user_id', testUserId)
      .order('expiry_date', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }, [testUserId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const atFridgeLimit = !isPremium && items.length >= FREE_FRIDGE_ITEMS;

  async function addItem() {
    if (!form.name || !form.expiry_date || !testUserId) return;
    if (atFridgeLimit) {
      alert(`Бесплатный лимит: ${FREE_FRIDGE_ITEMS} продуктов. Купите Premium для безлимита!`);
      return;
    }
    const { data } = await supabase
      .from('fridge_items')
      .insert({
        name: form.name,
        category: form.category === 'all' ? 'other' : form.category,
        quantity: form.quantity,
        expiry_date: form.expiry_date,
        icon: ICONS[form.category] || '📦',
        telegram_user_id: testUserId,
      })
      .select()
      .single();
    if (data) setItems([...items, data]);
    setForm({ name: '', category: 'other', expiry_date: '', quantity: '' });
    setShowForm(false);
  }

  async function removeItem(id: string) {
    await supabase.from('fridge_items').delete().eq('id', id).eq('telegram_user_id', testUserId);
    setItems(items.filter((i) => i.id !== id));
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="❄️ Холодильник" />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={atFridgeLimit}
            className="bg-accent text-background py-3 rounded-2xl font-medium disabled:opacity-50"
          >
            + Добавить
          </button>
          <Link
            href="/scan"
            className="bg-surface border border-border py-3 rounded-2xl font-medium text-center active:scale-[0.98] transition"
          >
            📷 Скан чека
          </Link>
        </div>

        {!isPremium && (
          <p className="text-xs text-muted mb-4 text-center">
            Продуктов: {items.length}/{FREE_FRIDGE_ITEMS}
            {atFridgeLimit && <span className="text-yellow-400"> — лимит достигнут</span>}
          </p>
        )}

        <input
          placeholder="🔍 Поиск продукта..."
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 placeholder-muted outline-none mb-3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {(Object.keys(CATEGORIES) as CategoryKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition ${
                categoryFilter === key
                  ? 'bg-accent text-background'
                  : 'bg-surface border border-border text-muted'
              }`}
            >
              {CATEGORIES[key]}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <input
              placeholder="Название продукта"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as CategoryKey })}
            >
              {Object.entries(CATEGORIES)
                .filter(([k]) => k !== 'all')
                .map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
            </select>
            <input
              placeholder="Количество (1л, 500г...)"
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
              Сохранить
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-accent">{items.length}</div>
            <div className="text-xs text-muted mt-1">Продуктов</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              {items.filter((i) => daysLeft(i.expiry_date) <= 1).length}
            </div>
            <div className="text-xs text-muted mt-1">Истекают</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {items.filter((i) => daysLeft(i.expiry_date) <= 3 && daysLeft(i.expiry_date) > 1).length}
            </div>
            <div className="text-xs text-muted mt-1">Скоро</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted py-10">Загрузка...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center text-muted py-20">
            <div className="text-5xl mb-4">❄️</div>
            <div>{items.length === 0 ? 'Холодильник пуст' : 'Ничего не найдено'}</div>
            <div className="text-sm mt-2">
              {items.length === 0 ? 'Добавьте продукт или отсканируйте чек' : 'Попробуйте другой фильтр'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const days = daysLeft(item.expiry_date);
              const catKey = item.category in CATEGORIES ? item.category : 'other';
              return (
                <div key={item.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {item.quantity} · {CATEGORIES[catKey]}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${expiryColor(days)}`}>
                      {days <= 0 ? '❌ Истёк' : days === 1 ? '⚠️ Сегодня истекает' : `📅 Ещё ${days} дн.`}
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

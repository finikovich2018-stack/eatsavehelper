'use client';
import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';

const CATEGORIES = {
  dairy: '🥛 Молочное',
  meat: '🥩 Мясо',
  veg: '🥦 Овощи',
  grains: '🌾 Крупы',
  other: '📦 Другое',
};

type Item = {
  id: string;
  name: string;
  category: keyof typeof CATEGORIES;
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
  return 'text-emerald-400';
}

const ICONS: Record<string, string> = {
  dairy: '🥛', meat: '🍗', veg: '🥦', grains: '🌾', other: '📦'
};

export default function FridgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'other', expiry_date: '', quantity: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from('fridge_items')
      .select('*')
      .order('expiry_date', { ascending: true });
    setItems(data || []);
    setLoading(false);
  }

  async function addItem() {
    if (!form.name || !form.expiry_date) return;
    const { data } = await supabase
      .from('fridge_items')
      .insert({
        name: form.name,
        category: form.category,
        quantity: form.quantity,
        expiry_date: form.expiry_date,
        icon: ICONS[form.category] || '📦',
      })
      .select()
      .single();
    if (data) setItems([...items, data]);
    setForm({ name: '', category: 'other', expiry_date: '', quantity: '' });
    setShowForm(false);
  }

  async function removeItem(id: string) {
    await supabase.from('fridge_items').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="🥬 Холодильник" />
      <div className="max-w-xl mx-auto px-4 py-4">

        <button onClick={() => setShowForm(!showForm)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl font-medium mb-4">
          + Добавить продукт
        </button>

        {showForm && (
          <div className="bg-zinc-900 rounded-2xl p-4 mb-4 space-y-3">
            <input placeholder="Название продукта"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 placeholder-zinc-500 outline-none"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="w-full bg-zinc-800 rounded-xl px-4 py-3 outline-none"
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input placeholder="Количество (1л, 500г...)"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 placeholder-zinc-500 outline-none"
              value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <input type="date"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 outline-none"
              value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
            <button onClick={addItem}
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-medium">
              Сохранить
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900 rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">{items.length}</div>
            <div className="text-xs text-zinc-500 mt-1">Продуктов</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-red-400">
              {items.filter(i => daysLeft(i.expiry_date) <= 1).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Истекают</div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {items.filter(i => daysLeft(i.expiry_date) <= 3 && daysLeft(i.expiry_date) > 1).length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Скоро</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-zinc-500 py-10">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-zinc-600 py-20">
            <div className="text-5xl mb-4">🥬</div>
            <div>Холодильник пуст</div>
            <div className="text-sm mt-2">Нажмите кнопку выше</div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const days = daysLeft(item.expiry_date);
              return (
                <div key={item.id} className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {item.quantity} · {CATEGORIES[item.category]}
                    </div>
                    <div className={`text-xs mt-1 font-medium ${expiryColor(days)}`}>
                      {days <= 0 ? '❌ Истёк' : days === 1 ? '⚠️ Сегодня истекает' : `📅 Ещё ${days} дн.`}
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)}
                    className="text-zinc-600 hover:text-red-400 text-xl px-2">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
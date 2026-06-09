'use client';
import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';

type Expense = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
};

const LIMIT = 15000;

export default function BudgetPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '' });

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }

  async function addExpense() {
    if (!form.name || !form.amount) return;
    const { data } = await supabase
      .from('expenses')
      .insert({
        name: form.name,
        amount: Number(form.amount),
        date: new Date().toISOString().split('T')[0],
        category: '🛒',
      })
      .select()
      .single();
    if (data) setExpenses([data, ...expenses]);
    setForm({ name: '', amount: '' });
    setShowForm(false);
  }

  async function removeExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(expenses.filter(e => e.id !== id));
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const percent = Math.min((total / LIMIT) * 100, 100);
  const remaining = LIMIT - total;

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="💰 Бюджет" />
      <div className="max-w-xl mx-auto px-4 py-4">

        {/* Карточка бюджета */}
        <div className="bg-gradient-to-br from-emerald-900 to-zinc-900 rounded-2xl p-5 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-xs text-zinc-400">Потрачено в июне</div>
              <div className="text-3xl font-bold mt-1">{total.toLocaleString()} ₽</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400">Лимит</div>
              <div className="text-lg font-medium mt-1">{LIMIT.toLocaleString()} ₽</div>
            </div>
          </div>
          <div className="bg-zinc-800 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{percent.toFixed(0)}% использовано</span>
            <span className={remaining < 0 ? 'text-red-400' : 'text-emerald-400'}>
              {remaining < 0 ? `Перерасход ${Math.abs(remaining).toLocaleString()} ₽` : `Остаток ${remaining.toLocaleString()} ₽`}
            </span>
          </div>
        </div>

        <button onClick={() => setShowForm(!showForm)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl font-medium mb-4">
          + Добавить трату
        </button>

        {showForm && (
          <div className="bg-zinc-900 rounded-2xl p-4 mb-4 space-y-3">
            <input placeholder="Название (магазин, продукт...)"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 placeholder-zinc-500 outline-none"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input type="number" placeholder="Сумма в рублях"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 placeholder-zinc-500 outline-none"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <button onClick={addExpense}
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-medium">
              Сохранить
            </button>
          </div>
        )}

        <h2 className="text-sm font-medium text-zinc-400 mb-3">История трат</h2>

        {loading ? (
          <div className="text-center text-zinc-500 py-10">Загрузка...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center text-zinc-600 py-20">
            <div className="text-5xl mb-4">💰</div>
            <div>Трат пока нет</div>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">{exp.category}</span>
                <div className="flex-1">
                  <div className="font-medium">{exp.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{exp.date}</div>
                </div>
                <div className="font-bold">{Number(exp.amount).toLocaleString()} ₽</div>
                <button onClick={() => removeExpense(exp.id)}
                  className="text-zinc-600 hover:text-red-400 text-xl px-1">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
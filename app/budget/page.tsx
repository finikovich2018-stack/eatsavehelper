'use client';
import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';

type Expense = {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  currency: string;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', CNY: '¥', JPY: '¥', INR: '₹',
};

const CURRENCY_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
  AUD: 700, CAD: 650, CHF: 450, CNY: 3500, JPY: 70000, INR: 40000,
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetPage() {
  const { user } = useTelegram();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', currency: 'RUB' });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('telegram_user_id', user?.id)
      .order('date', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  async function addExpense() {
    if (!form.name || !form.amount || !user?.id) return;
    const { data } = await supabase
      .from('expenses')
      .insert({
        name: form.name,
        amount: Number(form.amount),
        date: new Date().toISOString().split('T')[0],
        category: '🛒',
        currency: form.currency,
        telegram_user_id: user.id,
      })
      .select()
      .single();
    if (data) setExpenses([data, ...expenses]);
    setForm({ name: '', amount: '', currency: 'RUB' });
    setShowForm(false);
  }

  async function removeExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id).eq('telegram_user_id', user?.id);
    setExpenses(expenses.filter(e => e.id !== id));
  }

  // Группируем траты по валютам за текущий месяц
  const currentMonth = getCurrentMonth();
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));
  
  const byCurrency: Record<string, number> = {};
  monthExpenses.forEach(e => {
    const cur = e.currency || 'RUB';
    byCurrency[cur] = (byCurrency[cur] || 0) + Number(e.amount);
  });

  const activeCurrencies = Object.keys(byCurrency);

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="💰 Бюджет" />
      <div className="max-w-xl mx-auto px-4 py-4">

        {/* Карточки по валютам */}
        {activeCurrencies.length === 0 ? (
          <div className="bg-gradient-to-br from-emerald-900 to-zinc-900 rounded-2xl p-5 mb-4">
            <div className="text-xs text-zinc-400">Потрачено в этом месяце</div>
            <div className="text-3xl font-bold mt-1">0 ₽</div>
            <div className="bg-zinc-800 rounded-full h-3 mt-4">
              <div className="h-3 rounded-full bg-emerald-500" style={{ width: '0%' }} />
            </div>
            <div className="text-xs text-zinc-400 mt-2">Трат ещё нет</div>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {activeCurrencies.map(cur => {
              const total = byCurrency[cur];
              const symbol = CURRENCY_SYMBOLS[cur] || cur;
              const limit = CURRENCY_LIMITS[cur] || total * 2;
              const percent = Math.min((total / limit) * 100, 100);
              const remaining = limit - total;
              return (
                <div key={cur} className="bg-gradient-to-br from-emerald-900 to-zinc-900 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-xs text-zinc-400">Потрачено ({cur})</div>
                      <div className="text-3xl font-bold mt-1">
                        {cur === 'RUB' ? total.toLocaleString() : total.toFixed(2)} {symbol}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-400">Лимит</div>
                      <div className="text-lg font-medium mt-1">
                        {cur === 'RUB' ? limit.toLocaleString() : limit.toFixed(0)} {symbol}
                      </div>
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
                      {remaining < 0
                        ? `Перерасход ${Math.abs(remaining).toFixed(2)} ${symbol}`
                        : `Остаток ${cur === 'RUB' ? remaining.toLocaleString() : remaining.toFixed(2)} ${symbol}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => setShowForm(!showForm)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl font-medium mb-4">
          + Добавить трату
        </button>

        {showForm && (
          <div className="bg-zinc-900 rounded-2xl p-4 mb-4 space-y-3">
            <input placeholder="Название (магазин, продукт...)"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 placeholder-zinc-500 outline-none"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input type="number" placeholder="Сумма"
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 placeholder-zinc-500 outline-none"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <select
              className="w-full bg-zinc-800 rounded-xl px-4 py-3 outline-none"
              value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="RUB">₽ Рубль</option>
              <option value="USD">$ Доллар</option>
              <option value="EUR">€ Евро</option>
              <option value="GBP">£ Фунт</option>
              <option value="UAH">₴ Гривна</option>
              <option value="KZT">₸ Тенге</option>
              <option value="AUD">A$ Австралийский</option>
              <option value="CAD">C$ Канадский</option>
            </select>
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
            {expenses.map(exp => {
              const symbol = CURRENCY_SYMBOLS[exp.currency] || exp.currency || '₽';
              return (
                <div key={exp.id} className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-2xl">{exp.category}</span>
                  <div className="flex-1">
                    <div className="font-medium">{exp.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{exp.date}</div>
                  </div>
                  <div className="font-bold">{Number(exp.amount).toLocaleString()} {symbol}</div>
                  <button onClick={() => removeExpense(exp.id)}
                    className="text-zinc-600 hover:text-red-400 text-xl px-1">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
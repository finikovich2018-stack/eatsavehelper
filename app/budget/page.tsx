'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from '@/components/layout/TopBar';
import { dataApi } from '@/lib/client-api';
import { useDataAuth } from '@/lib/use-data-auth';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { formatLocalDate } from '@/lib/utils';
import { readSessionCache, writeSessionCache } from '@/lib/session-cache';
import Spinner from '@/components/ui/Spinner';
import type { TranslationKey } from '@/lib/i18n/translations';

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

const DEFAULT_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
  AUD: 700, CAD: 650, CHF: 450, CNY: 3500, JPY: 70000, INR: 40000,
};

const CURRENCY_OPTIONS: { value: string; key: TranslationKey }[] = [
  { value: 'RUB', key: 'cur.rub' },
  { value: 'USD', key: 'cur.usd' },
  { value: 'EUR', key: 'cur.eur' },
  { value: 'GBP', key: 'cur.gbp' },
  { value: 'UAH', key: 'cur.uah' },
  { value: 'KZT', key: 'cur.kzt' },
];

// Expense categories: the emoji is stored in expenses.category; labels are i18n.
const EXPENSE_CATEGORIES: { emoji: string; key: TranslationKey }[] = [
  { emoji: '🛒', key: 'expcat.groceries' },
  { emoji: '🥛', key: 'expcat.dairy' },
  { emoji: '🍗', key: 'expcat.meat' },
  { emoji: '🥦', key: 'expcat.veg' },
  { emoji: '🍞', key: 'expcat.bakery' },
  { emoji: '🍽', key: 'expcat.cafe' },
  { emoji: '📦', key: 'expcat.other' },
];

const EXPENSE_CATEGORY_LABEL: Record<string, TranslationKey> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.emoji, c.key])
);

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLast7Days(dateLocale: string) {
  const days: { label: string; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: d.toLocaleDateString(dateLocale, { weekday: 'short' }),
      date: formatLocalDate(d),
    });
  }
  return days;
}

export default function BudgetPage() {
  const auth = useDataAuth();
  const { t, dateLocale } = useI18n();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', currency: 'RUB', category: '🛒' });
  const [budgetForm, setBudgetForm] = useState({ amount: '15000', currency: 'RUB' });

  const monthStart = getCurrentMonth();

  const loadAll = useCallback(async () => {
    if (!auth) return;
    type CacheShape = { expenses: Expense[]; budgetLimits: Record<string, number> };
    const cacheKey = `eatsave_budget_v1_${auth.telegram_user_id}`;

    const cached = readSessionCache<CacheShape>(cacheKey);
    if (cached) {
      setExpenses(cached.expenses || []);
      setBudgetLimits(cached.budgetLimits || {});
      setLoading(false);
    }

    const [expensesRes, budgetsRes] = await Promise.all([
      dataApi.expenses.list(auth).catch(() => null),
      dataApi.budgets.list(auth, monthStart).catch(() => null),
    ]);

    const nextExpenses = expensesRes
      ? ((expensesRes.items || []) as Expense[])
      : cached?.expenses || [];

    let nextLimits = cached?.budgetLimits || { ...DEFAULT_LIMITS };
    if (budgetsRes) {
      nextLimits = { ...DEFAULT_LIMITS };
      (budgetsRes.items || []).forEach((row: { amount: number; currency: string }) => {
        nextLimits[row.currency] = Number(row.amount);
      });
    }

    if (expensesRes) setExpenses(nextExpenses);
    setBudgetLimits(nextLimits);
    setLoading(false);
    writeSessionCache<CacheShape>(cacheKey, { expenses: nextExpenses, budgetLimits: nextLimits });
  }, [auth, monthStart]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function saveBudgetLimit() {
    if (!auth || !budgetForm.amount) return;
    const amount = Number(budgetForm.amount);
    await dataApi.budgets.upsert(auth, {
      month: monthStart,
      amount,
      currency: budgetForm.currency,
    });
    setBudgetLimits((prev) => ({ ...prev, [budgetForm.currency]: amount }));
    setShowBudgetForm(false);
  }

  async function addExpense() {
    if (!form.name || !form.amount || !auth) return;
    const { item } = await dataApi.expenses.insert(auth, {
      name: form.name,
      amount: Number(form.amount),
      date: formatLocalDate(),
      category: form.category || '🛒',
      currency: form.currency,
    });
    if (item) setExpenses([item as Expense, ...expenses]);
    setForm({ name: '', amount: '', currency: 'RUB', category: '🛒' });
    setShowForm(false);
  }

  async function removeExpense(id: string) {
    if (!auth) return;
    await dataApi.expenses.delete(auth, id);
    setExpenses(expenses.filter((e) => e.id !== id));
  }

  const currentMonth = monthStart.slice(0, 7);
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth));

  const byCurrency: Record<string, number> = {};
  monthExpenses.forEach((e) => {
    const cur = e.currency || 'RUB';
    byCurrency[cur] = (byCurrency[cur] || 0) + Number(e.amount);
  });

  const activeCurrencies = Object.keys(byCurrency);

  const weeklyChart = useMemo(() => {
    const days = getLast7Days(dateLocale);
    const primaryCurrency = activeCurrencies[0] || 'RUB';
    return days.map((day) => {
      const total = expenses
        .filter((e) => {
          const expenseDate = String(e.date || '').slice(0, 10);
          return expenseDate === day.date && (e.currency || 'RUB') === primaryCurrency;
        })
        .reduce((sum, e) => sum + Number(e.amount), 0);
      return { ...day, total };
    });
  }, [expenses, activeCurrencies, dateLocale]);

  const maxWeekly = Math.max(...weeklyChart.map((d) => d.total), 1);
  const primaryCur = activeCurrencies[0] || 'RUB';
  const primaryLimit = budgetLimits[primaryCur] || DEFAULT_LIMITS[primaryCur];
  const primarySpent = byCurrency[primaryCur] || 0;
  const savedEstimate = Math.max(0, primaryLimit - primarySpent);
  const primaryPercent = primaryLimit > 0 ? (primarySpent / primaryLimit) * 100 : 0;

  const prevMonthKey = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const prevMonthSpent = expenses
    .filter((e) => e.date.startsWith(prevMonthKey) && (e.currency || 'RUB') === primaryCur)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const monthDiffPct =
    prevMonthSpent > 0 ? Math.round(((primarySpent - prevMonthSpent) / prevMonthSpent) * 100) : null;

  const topSpends = useMemo(
    () => [...monthExpenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3),
    [monthExpenses]
  );

  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    monthExpenses
      .filter((e) => (e.currency || 'RUB') === primaryCur)
      .forEach((e) => {
        const cat = e.category || '📦';
        totals[cat] = (totals[cat] || 0) + Number(e.amount);
      });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    return {
      sum,
      rows: Object.entries(totals)
        .map(([emoji, amount]) => ({ emoji, amount, pct: sum > 0 ? (amount / sum) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [monthExpenses, primaryCur]);

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('budget.title')} />
      <div className="max-w-mobile mx-auto px-4 py-4">
        {activeCurrencies.length === 0 ? (
          <div className="bg-gradient-to-br from-surface to-background border border-border rounded-2xl p-5 mb-4 anim-rise-in">
            <div className="text-xs text-muted">{t('budget.spentMonth')}</div>
            <div className="text-3xl font-bold mt-1">0 ₽</div>
            <div className="bg-background/60 rounded-full h-3 mt-4 overflow-hidden">
              <div className="h-3 rounded-full bg-accent home-bar-fill" style={{ width: '0%' }} />
            </div>
            <div className="text-xs text-muted mt-2">{t('budget.noExpenses')}</div>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {activeCurrencies.map((cur, idx) => {
              const total = byCurrency[cur];
              const symbol = CURRENCY_SYMBOLS[cur] || cur;
              const limit = budgetLimits[cur] || DEFAULT_LIMITS[cur] || total * 2;
              const percent = Math.min((total / limit) * 100, 100);
              const remaining = limit - total;
              return (
                <div
                  key={cur}
                  className={`bg-gradient-to-br from-surface to-background border rounded-2xl p-5 anim-rise-in ${
                    percent >= 100 ? 'border-red-500/40 glow-pulse' : percent >= 80 ? 'border-yellow-500/35' : 'border-border'
                  }`}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-xs text-muted">{t('budget.spent', { cur })}</div>
                      <div className="text-3xl font-bold mt-1">
                        {cur === 'RUB' ? total.toLocaleString() : total.toFixed(2)} {symbol}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted">{t('budget.limit')}</div>
                      <div className="text-lg font-medium mt-1">
                        {cur === 'RUB' ? limit.toLocaleString() : limit.toFixed(0)} {symbol}
                      </div>
                    </div>
                  </div>
                  <div className="bg-background/60 rounded-full h-3 mb-2 overflow-hidden">
                    <div
                      className={`home-bar-fill h-3 rounded-full ${
                        percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-accent'
                      }`}
                      style={{ width: `${percent}%`, animationDelay: `${0.15 + idx * 0.1}s` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted">
                    <span>{t('budget.used', { pct: percent.toFixed(0) })}</span>
                    <span className={remaining < 0 ? 'text-red-400' : 'text-accent'}>
                      {remaining < 0
                        ? t('budget.over', { amount: Math.abs(remaining).toFixed(2), symbol })
                        : t('budget.left', {
                            amount: cur === 'RUB' ? remaining.toLocaleString() : remaining.toFixed(2),
                            symbol,
                          })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeCurrencies.length > 0 && primaryPercent >= 80 && (
          <div
            className={`rounded-2xl p-4 mb-4 text-sm font-medium anim-rise-in ${
              primaryPercent >= 100
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 glow-pulse'
                : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 home-urgent-badge'
            }`}
          >
            {t('budget.nearLimit', { pct: Math.round(primaryPercent) })}
          </div>
        )}

        {activeCurrencies.length > 0 && monthDiffPct !== null && (
          <div className="bg-surface border border-border rounded-2xl px-4 py-3 mb-4 text-sm text-center">
            {monthDiffPct < 0 ? (
              <span className="text-accent">{t('budget.vsLess', { pct: Math.abs(monthDiffPct) })}</span>
            ) : monthDiffPct > 0 ? (
              <span className="text-red-400">{t('budget.vsMore', { pct: monthDiffPct })}</span>
            ) : (
              <span className="text-muted">{t('budget.vsSame')}</span>
            )}
          </div>
        )}

        {savedEstimate > 0 && activeCurrencies.length > 0 && (
          <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 mb-4 text-center glow-pulse anim-rise-in">
            <span className="text-sm text-muted">{t('budget.savings')}</span>
            <span className="text-accent font-bold">
              {savedEstimate.toLocaleString()} {CURRENCY_SYMBOLS[primaryCur] || primaryCur}
            </span>
            <span className="text-sm text-muted">{t('budget.savingsEnd')}</span>
          </div>
        )}

        {categoryBreakdown.rows.length > 1 && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-medium text-muted mb-3">{t('budget.byCategory')}</h3>
            <div className="space-y-3">
              {categoryBreakdown.rows.map((row) => {
                const symbol = CURRENCY_SYMBOLS[primaryCur] || primaryCur;
                const label = EXPENSE_CATEGORY_LABEL[row.emoji];
                return (
                  <div key={row.emoji}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>
                        {row.emoji} {label ? t(label) : t('expcat.other')}
                      </span>
                      <span className="text-muted">
                        {Math.round(row.amount).toLocaleString()} {symbol} · {row.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="bg-background/60 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-accent home-bar-fill"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {topSpends.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-medium text-muted mb-3">{t('budget.topSpends')}</h3>
            <div className="space-y-2">
              {topSpends.map((exp, idx) => {
                const symbol = CURRENCY_SYMBOLS[exp.currency] || exp.currency || '₽';
                return (
                  <div key={exp.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted w-4">{idx + 1}</span>
                    <span className="text-lg">{exp.category}</span>
                    <span className="flex-1 text-sm truncate">{exp.name}</span>
                    <span className="text-sm font-semibold">
                      {Number(exp.amount).toLocaleString()} {symbol}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-surface border border-border rounded-2xl p-4 mb-4 anim-rise-in anim-delay-2">
          <h3 className="text-sm font-medium text-muted mb-3">{t('budget.chart7days')}</h3>
          <div className="flex items-end justify-between gap-1 h-24">
            {weeklyChart.map((day, i) => {
              const barPx =
                day.total > 0 ? Math.max(Math.round((day.total / maxWeekly) * 72), 10) : 4;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                >
                  <div
                    className="w-full bg-accent/80 rounded-t-md bar-grow-v"
                    style={{ height: `${barPx}px`, animationDelay: `${i * 0.06}s` }}
                    title={`${day.total}`}
                  />
                  <span className="text-[10px] text-muted mt-1 shrink-0">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setShowBudgetForm(!showBudgetForm)}
          className="w-full bg-surface border border-border hover:border-accent/50 py-3 rounded-2xl font-medium mb-4"
        >
          {t('budget.setLimit')}
        </button>

        {showBudgetForm && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <input
              type="number"
              placeholder={t('budget.limitPlaceholder')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={budgetForm.amount}
              onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
            />
            <select
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
              value={budgetForm.currency}
              onChange={(e) => setBudgetForm({ ...budgetForm, currency: e.target.value })}
            >
              {CURRENCY_OPTIONS.slice(0, 3).map(({ value, key }) => (
                <option key={value} value={value}>{t(key)}</option>
              ))}
            </select>
            <button
              onClick={saveBudgetLimit}
              className="w-full bg-accent text-background py-3 rounded-xl font-medium"
            >
              {t('budget.saveLimit')}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-accent text-background py-3 rounded-2xl font-medium mb-4 glow-pulse anim-rise-in anim-delay-3"
        >
          {t('budget.addExpense')}
        </button>

        {showForm && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <input
              placeholder={t('budget.expenseName')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="number"
              placeholder={t('budget.amount')}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 placeholder-muted outline-none"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map(({ emoji, key }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm({ ...form, category: emoji })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    form.category === emoji
                      ? 'bg-accent text-background'
                      : 'bg-background border border-border text-muted'
                  }`}
                >
                  {emoji} {t(key)}
                </button>
              ))}
            </div>
            <select
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {CURRENCY_OPTIONS.map(({ value, key }) => (
                <option key={value} value={value}>{t(key)}</option>
              ))}
            </select>
            <button
              onClick={addExpense}
              className="w-full bg-accent text-background py-3 rounded-xl font-medium"
            >
              {t('common.save')}
            </button>
          </div>
        )}

        <h2 className="text-sm font-medium text-muted mb-3">{t('budget.history')}</h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted">
            <Spinner className="w-6 h-6 border-muted/30 border-t-accent" />
            <span>{t('common.loading')}</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center text-muted py-20">
            <div className="text-5xl mb-4 float-soft inline-block">💰</div>
            <div>{t('budget.noHistory')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp, i) => {
              const symbol = CURRENCY_SYMBOLS[exp.currency] || exp.currency || '₽';
              return (
                <div
                  key={exp.id}
                  className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 anim-rise-in"
                  style={{ animationDelay: `${0.06 + i * 0.05}s` }}
                >
                  <span className="text-2xl home-action-icon" style={{ animationDelay: `${i * 0.2}s` }}>
                    {exp.category}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{exp.name}</div>
                    <div className="text-xs text-muted mt-0.5">{exp.date}</div>
                  </div>
                  <div className="font-bold">
                    {Number(exp.amount).toLocaleString()} {symbol}
                  </div>
                  <button
                    onClick={() => removeExpense(exp.id)}
                    className="text-muted hover:text-red-400 text-xl px-1"
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

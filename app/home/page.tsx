'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { dataApi } from '@/lib/client-api';
import { readHomeCache, writeHomeCache } from '@/lib/home-cache';
import { useDataAuth } from '@/lib/use-data-auth';
import { useI18n } from '@/lib/i18n/LanguageProvider';

type FridgeItem = {
  id: string;
  name: string;
  icon: string;
  expiry_date: string;
  quantity: string;
};

type BudgetSummary = {
  spent: number;
  limit: number;
  currency: string;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸',
};

const DEFAULT_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
};

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function buildHomeState(data: {
  expiringItems: { id: string; name: string; icon?: string | null; expiry_date?: string | null; quantity?: string | null }[];
  productCount: number;
  expiringSoonCount: number;
  expenses: { amount: number; currency: string }[];
  budgets: { amount: number; currency: string }[];
  recipeCount: number;
  shoppingCount: number;
}) {
  const expiring = (data.expiringItems || []).map((item) => ({
    id: item.id,
    name: item.name,
    icon: item.icon || '📦',
    expiry_date: item.expiry_date || '',
    quantity: item.quantity || '',
  }));
  const stats = {
    products: data.productCount || 0,
    expiringSoon: data.expiringSoonCount || 0,
    recipes: data.recipeCount || 0,
    shopping: data.shoppingCount || 0,
  };

  const byCurrency: Record<string, number> = {};
  (data.expenses || []).forEach((row) => {
    const cur = row.currency || 'RUB';
    byCurrency[cur] = (byCurrency[cur] || 0) + Number(row.amount || 0);
  });

  const budgetRows = data.budgets || [];
  const limits: Record<string, number> = { ...DEFAULT_LIMITS };
  budgetRows.forEach((row) => {
    limits[row.currency] = Number(row.amount);
  });

  const primaryCur =
    Object.keys(byCurrency)[0] ||
    (budgetRows as { currency: string }[])?.[0]?.currency ||
    'RUB';

  const budget = {
    spent: byCurrency[primaryCur] || 0,
    limit: limits[primaryCur] || DEFAULT_LIMITS[primaryCur] || 15000,
    currency: primaryCur,
  };

  return { expiring, stats, budget };
}

export default function HomePage() {
  const auth = useDataAuth();
  const { t, dateLocale } = useI18n();
  const [expiring, setExpiring] = useState<FridgeItem[]>([]);
  const [budget, setBudget] = useState<BudgetSummary>({ spent: 0, limit: 15000, currency: 'RUB' });
  const [stats, setStats] = useState({ products: 0, expiringSoon: 0, recipes: 0, shopping: 0 });
  const [fridgeLoading, setFridgeLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const monthName = new Date().toLocaleString(dateLocale, { month: 'long' });

  const loadData = useCallback(async () => {
    if (!auth) return;

    const cached = readHomeCache(auth.telegram_user_id);
    if (cached) {
      setExpiring(cached.expiring);
      setBudget(cached.budget);
      setStats(cached.stats);
      setFridgeLoading(false);
      setStatsLoading(false);
    } else {
      setFridgeLoading(true);
      setStatsLoading(true);
    }

    try {
      const monthStart = getMonthStart();
      const data = await dataApi.home.summary(auth, monthStart);
      const snapshot = buildHomeState(data);
      setExpiring(snapshot.expiring);
      setStats(snapshot.stats);
      setBudget(snapshot.budget);
      writeHomeCache(auth.telegram_user_id, snapshot);
    } catch (error) {
      console.error('Home load error:', error);
    } finally {
      setFridgeLoading(false);
      setStatsLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const symbol = CURRENCY_SYMBOLS[budget.currency] || budget.currency;
  const percent = budget.limit > 0 ? Math.min((budget.spent / budget.limit) * 100, 100) : 0;
  const remaining = budget.limit - budget.spent;

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('home.title')} />
      <div className="max-w-mobile mx-auto px-4 py-4 space-y-6">
        <div className="bg-gradient-to-br from-surface to-background border border-border rounded-3xl p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs text-muted">{t('home.budgetFor', { month: monthName })}</div>
              {statsLoading ? (
                <div className="text-2xl font-bold mt-1 text-muted animate-pulse">...</div>
              ) : (
                <div className="text-2xl font-bold mt-1">
                  {budget.spent.toLocaleString()} / {budget.limit.toLocaleString()} {symbol}
                </div>
              )}
            </div>
            <Link href="/budget" className="text-xs text-accent font-medium">{t('common.change')}</Link>
          </div>
          <div className="bg-background/60 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-accent'}`}
              style={{ width: statsLoading ? '0%' : `${percent}%` }}
            />
          </div>
          <div className="text-xs text-muted">
            {statsLoading
              ? '...'
              : remaining >= 0
                ? t('home.remaining', { amount: remaining.toLocaleString(), symbol })
                : t('home.overBudget', { amount: Math.abs(remaining).toLocaleString(), symbol })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{t('home.expiringSoon')}</h2>
            <Link href="/fridge" className="text-xs text-accent">{t('common.all')}</Link>
          </div>
          {fridgeLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-surface border border-border rounded-2xl p-4 h-16 animate-pulse"
                />
              ))}
            </div>
          ) : expiring.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-5 text-center text-muted text-sm">
              {t('home.noExpiring')}
            </div>
          ) : (
            <div className="space-y-2">
              {expiring.map((item) => {
                const days = daysLeft(item.expiry_date);
                return (
                  <div key={item.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted">{item.quantity}</div>
                    </div>
                    <span className={`text-xs font-semibold ${days <= 1 ? 'text-red-400' : days <= 3 ? 'text-yellow-400' : 'text-accent'}`}>
                      {days <= 0 ? t('common.today') : t('common.days', { n: days })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-3">{t('home.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/scan" className="bg-accent text-background rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition">
              <div className="text-2xl mb-1">📷</div>
              {t('home.scanReceipt')}
            </Link>
            <Link href="/fridge" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition">
              <div className="text-2xl mb-1">➕</div>
              {t('home.addProduct')}
            </Link>
            <Link href="/recipes" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition">
              <div className="text-2xl mb-1">👨‍🍳</div>
              {t('home.recipes')}
            </Link>
            <Link href="/shopping" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition">
              <div className="text-2xl mb-1">🛒</div>
              {t('home.shoppingList')}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Link
            href="/fridge"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-accent">{statsLoading ? '…' : stats.products}</div>
            <div className="text-xs text-muted mt-1">{t('home.products')}</div>
          </Link>
          <Link
            href="/fridge?filter=expiring"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-yellow-400">{statsLoading ? '…' : stats.expiringSoon}</div>
            <div className="text-xs text-muted mt-1">{t('home.expiringCount')}</div>
          </Link>
          <Link
            href="/recipes"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-accent">{statsLoading ? '…' : stats.recipes}</div>
            <div className="text-xs text-muted mt-1">{t('home.recipesCount')}</div>
          </Link>
          <Link
            href="/shopping"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-accent">{statsLoading ? '…' : stats.shopping}</div>
            <div className="text-xs text-muted mt-1">{t('home.shoppingCount')}</div>
          </Link>
        </div>
      </div>
    </main>
  );
}

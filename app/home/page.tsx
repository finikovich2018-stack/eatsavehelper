'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';
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

import { formatLocalDate } from '@/lib/utils';

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

export default function HomePage() {
  const { user } = useTelegram();
  const { t, dateLocale } = useI18n();
  const [expiring, setExpiring] = useState<FridgeItem[]>([]);
  const [budget, setBudget] = useState<BudgetSummary>({ spent: 0, limit: 15000, currency: 'RUB' });
  const [stats, setStats] = useState({ products: 0, expiringSoon: 0, recipes: 0 });
  const [loading, setLoading] = useState(true);

  const monthName = new Date().toLocaleString(dateLocale, { month: 'long' });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: items } = await supabase
        .from('fridge_items')
        .select('id, name, icon, expiry_date, quantity')
        .eq('telegram_user_id', user.id)
        .order('expiry_date', { ascending: true });

      const allItems = items || [];
      const soon = allItems.filter((item) => {
        const days = daysLeft(item.expiry_date);
        return days >= 0 && days <= 3;
      });

      setExpiring(soon.slice(0, 5));
      setStats({
        products: allItems.length,
        expiringSoon: allItems.filter((item) => {
          const days = daysLeft(item.expiry_date);
          return days >= 0 && days <= 3;
        }).length,
        recipes: 0,
      });

      const monthStart = getMonthStart();
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, currency')
        .eq('telegram_user_id', user.id)
        .gte('date', monthStart);

      const monthExpenses = expenses || [];
      const byCurrency: Record<string, number> = {};
      monthExpenses.forEach((row) => {
        const cur = row.currency || 'RUB';
        byCurrency[cur] = (byCurrency[cur] || 0) + Number(row.amount || 0);
      });

      const { data: budgetRows } = await supabase
        .from('budgets')
        .select('amount, currency')
        .eq('telegram_user_id', user.id)
        .eq('month', monthStart);

      const limits: Record<string, number> = { ...DEFAULT_LIMITS };
      (budgetRows || []).forEach((row: { amount: number; currency: string }) => {
        limits[row.currency] = Number(row.amount);
      });

      const primaryCur =
        Object.keys(byCurrency)[0] ||
        budgetRows?.[0]?.currency ||
        'RUB';

      setBudget({
        spent: byCurrency[primaryCur] || 0,
        limit: limits[primaryCur] || DEFAULT_LIMITS[primaryCur] || 15000,
        currency: primaryCur,
      });

      const { count: recipeCount } = await supabase
        .from('saved_recipes')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', user.id);

      setStats((prev) => ({ ...prev, recipes: recipeCount || 0 }));
    } catch (error) {
      console.error('Home load error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fridge_items' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadData]);

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
              <div className="text-2xl font-bold mt-1">
                {budget.spent.toLocaleString()} / {budget.limit.toLocaleString()} {symbol}
              </div>
            </div>
            <Link href="/budget" className="text-xs text-accent font-medium">{t('common.change')}</Link>
          </div>
          <div className="bg-background/60 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-accent'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-muted">
            {remaining >= 0
              ? t('home.remaining', { amount: remaining.toLocaleString(), symbol })
              : t('home.overBudget', { amount: Math.abs(remaining).toLocaleString(), symbol })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{t('home.expiringSoon')}</h2>
            <Link href="/fridge" className="text-xs text-accent">{t('common.all')}</Link>
          </div>
          {loading ? (
            <p className="text-sm text-muted">{t('common.loading')}</p>
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
            <Link href="/profile" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition">
              <div className="text-2xl mb-1">📊</div>
              {t('home.stats')}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/fridge"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-accent">{stats.products}</div>
            <div className="text-xs text-muted mt-1">{t('home.products')}</div>
          </Link>
          <Link
            href="/fridge?filter=expiring"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-yellow-400">{stats.expiringSoon}</div>
            <div className="text-xs text-muted mt-1">{t('home.expiringCount')}</div>
          </Link>
          <Link
            href="/recipes"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition"
          >
            <div className="text-xl font-bold text-accent">{stats.recipes}</div>
            <div className="text-xs text-muted mt-1">{t('home.recipesCount')}</div>
          </Link>
        </div>
      </div>
    </main>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { dataApi } from '@/lib/client-api';
import { readHomeCache, writeHomeCache } from '@/lib/home-cache';
import { buildHomeState, getMonthStart } from '@/lib/home-summary';
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

function daysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function applySnapshot(
  snapshot: ReturnType<typeof buildHomeState>,
  setExpiring: (v: FridgeItem[]) => void,
  setStats: (v: { products: number; expiringSoon: number; recipes: number; shopping: number }) => void,
  setBudget: (v: BudgetSummary) => void
) {
  setExpiring(snapshot.expiring);
  setStats(snapshot.stats);
  setBudget(snapshot.budget);
}

export default function HomePage() {
  const auth = useDataAuth();
  const { t, dateLocale } = useI18n();
  const [expiring, setExpiring] = useState<FridgeItem[]>([]);
  const [budget, setBudget] = useState<BudgetSummary>({ spent: 0, limit: 15000, currency: 'RUB' });
  const [stats, setStats] = useState({ products: 0, expiringSoon: 0, recipes: 0, shopping: 0 });
  const [consumeStats, setConsumeStats] = useState<{
    eaten: number;
    wasted: number;
    wasteFreeDays: number;
    wastedMoney: { currency: string; amount: number }[];
  } | null>(null);

  const monthName = new Date().toLocaleString(dateLocale, { month: 'long' });

  const loadData = useCallback(async () => {
    if (!auth) return;

    const cached = readHomeCache(auth.telegram_user_id);
    if (cached) {
      applySnapshot(cached, setExpiring, setStats, setBudget);
      if (cached.consumeStats !== undefined) setConsumeStats(cached.consumeStats);
    }

    // Fetch summary and monthly stats together so the whole page renders in one
    // pass (no late-appearing "monthly summary" card / layout shift).
    const [summaryRes, statsRes] = await Promise.all([
      dataApi.home.summary(auth, getMonthStart()).catch((error) => {
        console.error('Home load error:', error);
        return null;
      }),
      dataApi.fridge.stats(auth).catch(() => null),
    ]);

    const nextConsume =
      statsRes && statsRes.available
        ? {
            eaten: statsRes.eaten,
            wasted: statsRes.wasted,
            wasteFreeDays: statsRes.wasteFreeDays,
            wastedMoney: statsRes.wastedMoney || [],
          }
        : null;

    if (summaryRes) {
      const snapshot = buildHomeState(summaryRes);
      applySnapshot(snapshot, setExpiring, setStats, setBudget);
      setConsumeStats(nextConsume);
      writeHomeCache(auth.telegram_user_id, { ...snapshot, consumeStats: nextConsume });
    } else {
      setConsumeStats(nextConsume);
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
        <div className="bg-gradient-to-br from-surface to-background border border-border rounded-3xl p-5 anim-rise-in">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs text-muted">{t('home.budgetFor', { month: monthName })}</div>
              <div className="text-2xl font-bold mt-1">
                {budget.spent.toLocaleString()} / {budget.limit.toLocaleString()} {symbol}
              </div>
            </div>
            <Link href="/budget" className="text-xs text-accent font-medium">{t('common.change')}</Link>
          </div>
          <div className="bg-background/60 rounded-full h-3 mb-2 overflow-hidden">
            <div
              className={`home-bar-fill h-3 rounded-full ${percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-yellow-500' : 'bg-accent'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="text-xs text-muted">
            {remaining >= 0
              ? t('home.remaining', { amount: remaining.toLocaleString(), symbol })
              : t('home.overBudget', { amount: Math.abs(remaining).toLocaleString(), symbol })}
          </div>
        </div>

        {consumeStats && consumeStats.eaten + consumeStats.wasted > 0 && (
          <Link href="/fridge" className="block bg-surface border border-border rounded-2xl p-4 active:scale-[0.99] transition anim-rise-in anim-delay-1 glow-pulse">
            <div className="text-xs text-muted mb-3">{t('home.savingsSummary')} ›</div>
            <div className="flex items-center justify-around text-center">
              <div>
                <div className="text-xl font-bold text-accent">🍽 {consumeStats.eaten}</div>
                <div className="text-xs text-muted mt-0.5">{t('fridge.statEaten')}</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="text-xl font-bold text-red-400">🗑 {consumeStats.wasted}</div>
                <div className="text-xs text-muted mt-0.5">{t('fridge.statWasted')}</div>
              </div>
            </div>
            {consumeStats.wastedMoney.length > 0 && (
              <div className="mt-3 text-center text-sm font-medium text-red-400">
                {t('fridge.wastedMoney', {
                  amount: consumeStats.wastedMoney
                    .map((m) => `${Math.round(m.amount).toLocaleString()} ${CURRENCY_SYMBOLS[m.currency] || m.currency}`)
                    .join(' + '),
                })}
              </div>
            )}
            {consumeStats.wasteFreeDays > 0 && (
              <div className="mt-3 text-center text-sm font-medium text-accent">
                {t('fridge.wasteFree', { n: consumeStats.wasteFreeDays })}
              </div>
            )}
          </Link>
        )}

        <div className="anim-rise-in anim-delay-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{t('home.expiringSoon')}</h2>
            <Link href="/fridge" className="text-xs text-accent">{t('common.all')}</Link>
          </div>
          {expiring.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-5 text-center text-muted text-sm">
              <div className="text-3xl mb-2 float-soft inline-block">✅</div>
              {t('home.noExpiring')}
            </div>
          ) : (
            <div className="space-y-2">
              {expiring.map((item, i) => {
                const days = daysLeft(item.expiry_date);
                return (
                  <div
                    key={item.id}
                    className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 anim-rise-in"
                    style={{ animationDelay: `${0.12 + i * 0.06}s` }}
                  >
                    <span className="text-2xl home-action-icon" style={{ animationDelay: `${i * 0.3}s` }}>
                      {item.icon}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted">{item.quantity}</div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${days <= 1 ? 'text-red-400 home-urgent-badge' : days <= 3 ? 'text-yellow-400' : 'text-accent'}`}
                    >
                      {days <= 0 ? t('common.today') : t('common.days', { n: days })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-3 anim-rise-in anim-delay-3">{t('home.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/scan" className="home-scan-card bg-accent text-background rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition anim-rise-in anim-delay-4">
              <div className="text-2xl mb-1 home-action-icon home-action-icon-1">📷</div>
              {t('home.scanReceipt')}
            </Link>
            <Link href="/fridge" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition anim-rise-in anim-delay-5">
              <div className="text-2xl mb-1 home-action-icon home-action-icon-2">➕</div>
              {t('home.addProduct')}
            </Link>
            <Link href="/recipes" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition anim-rise-in anim-delay-5">
              <div className="text-2xl mb-1 home-action-icon home-action-icon-3">👨‍🍳</div>
              {t('home.recipes')}
            </Link>
            <Link href="/shopping" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium active:scale-[0.98] transition anim-rise-in anim-delay-6">
              <div className="text-2xl mb-1 home-action-icon home-action-icon-4">🛒</div>
              {t('home.shoppingList')}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 anim-rise-in anim-delay-4">
          <Link
            href="/fridge"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition anim-rise-in"
            style={{ animationDelay: '0.28s' }}
          >
            <div className="text-xl font-bold text-accent">{stats.products}</div>
            <div className="text-xs text-muted mt-1">{t('home.products')}</div>
          </Link>
          <Link
            href="/fridge?filter=expiring"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition anim-rise-in"
            style={{ animationDelay: '0.34s' }}
          >
            <div className="text-xl font-bold text-yellow-400">{stats.expiringSoon}</div>
            <div className="text-xs text-muted mt-1">{t('home.expiringCount')}</div>
          </Link>
          <Link
            href="/recipes"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition anim-rise-in"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="text-xl font-bold text-accent">{stats.recipes}</div>
            <div className="text-xs text-muted mt-1">{t('home.recipesCount')}</div>
          </Link>
          <Link
            href="/shopping"
            className="bg-surface border border-border rounded-2xl p-3 text-center active:scale-[0.97] transition anim-rise-in"
            style={{ animationDelay: '0.46s' }}
          >
            <div className="text-xl font-bold text-accent">{stats.shopping}</div>
            <div className="text-xs text-muted mt-1">{t('home.shoppingCount')}</div>
          </Link>
        </div>
      </div>
    </main>
  );
}

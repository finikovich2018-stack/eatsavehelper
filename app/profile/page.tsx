'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { dataApi } from '@/lib/client-api';
import { useDataAuth } from '@/lib/use-data-auth';
import { useTelegram } from '@/components/TelegramProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { PREMIUM_PRICE_STARS, REFERRAL_BONUS_DAYS } from '@/lib/constants';
import { ACHIEVEMENT_BONUS_DAYS, computeAchievements } from '@/lib/achievements';
import { hasPremiumAccess, isPremiumActive } from '@/lib/user-utils';
import { formatLocalDate } from '@/lib/utils';
import type { TranslationKey } from '@/lib/i18n/translations';

type ReceiptRow = {
  id: string;
  store_name: string | null;
  total_amount: number;
  currency: string;
  scanned_at: string;
};

type UserProfile = {
  is_premium?: boolean;
  premium_until?: string | null;
  notifications_enabled?: boolean;
  notify_hour?: number;
  timezone?: string;
  achievement_bonus_month?: string | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸', AUD: 'A$', CAD: 'C$',
};

type Stats = {
  fridgeCount: number;
  byCurrency: Record<string, number>;
  receiptCount: number;
  aiRecipeCount: number;
  budgetLimit: number;
  primaryCurrency: string;
  expenses: { amount: number; date: string; currency?: string | null }[];
};

const ACHIEVEMENT_META: Record<
  string,
  { icon: string; titleKey: TranslationKey; descKey: TranslationKey }
> = {
  budget: { icon: '💰', titleKey: 'ach.budget.title', descKey: 'ach.budget.desc' },
  receipt: { icon: '🧾', titleKey: 'ach.receipt.title', descKey: 'ach.receipt.desc' },
  chef: { icon: '👨‍🍳', titleKey: 'ach.chef.title', descKey: 'ach.chef.desc' },
  saver: { icon: '🌱', titleKey: 'ach.saver.title', descKey: 'ach.saver.desc' },
};

export default function ProfilePage() {
  const auth = useDataAuth();
  const { user, initData, dbUser, refreshUser } = useTelegram();
  const { t, locale, setLocale, dateLocale } = useI18n();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notifyTimeBusy, setNotifyTimeBusy] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState<ReceiptRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    fridgeCount: 0,
    byCurrency: {},
    receiptCount: 0,
    aiRecipeCount: 0,
    budgetLimit: 15000,
    primaryCurrency: 'RUB',
    expenses: [],
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [household, setHousehold] = useState<{
    role: 'owner' | 'member';
    members: { telegram_user_id: number; first_name: string | null; username: string | null; role: string }[];
    memberCount: number;
    maxMembers: number;
    canInvite: boolean;
    ownerHasPremium: boolean;
  } | null>(null);
  const [familyBusy, setFamilyBusy] = useState(false);
  const [referral, setReferral] = useState<{
    link: string;
    invited: number;
    bonusDays: number;
    bonusPerInvite: number;
    milestoneSize?: number;
    milestoneBonusDays?: number;
    toNextMilestone?: number;
  } | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return null;
    const profile = await refreshUser();
    if (profile) setUserProfile(profile);
    return profile as UserProfile | null;
  }, [user?.id, refreshUser]);

  const loadStats = useCallback(async () => {
    if (!auth) return;
    setLoading(true);

    try {
      const monthStart = formatLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

      const [fridgeRes, receiptRes, aiRes, expensesRes, budgetsRes, receiptsListRes] =
        await Promise.all([
          dataApi.fridge.count(auth),
          dataApi.receipts.count(auth),
          dataApi.recipes.count(auth, 'ai'),
          dataApi.expenses.list(auth, { monthStart }),
          dataApi.budgets.list(auth, monthStart),
          dataApi.receipts.list(auth, 7),
        ]);

      const expensesData = (expensesRes.items || []) as {
        amount: number;
        currency?: string;
        date: string;
      }[];

      const byCurrency: Record<string, number> = {};
      expensesData.forEach((e) => {
        const cur = e.currency || 'RUB';
        byCurrency[cur] = (byCurrency[cur] || 0) + (Number(e.amount) || 0);
      });

      const primaryCurrency = Object.keys(byCurrency)[0] || 'RUB';
      const budgetRows = (budgetsRes.items || []) as { amount: number; currency: string }[];
      const budgetRow = budgetRows.find((b) => b.currency === primaryCurrency);
      const budgetLimit = Number(budgetRow?.amount || (primaryCurrency === 'RUB' ? 15000 : 500));

      setRecentReceipts((receiptsListRes.items || []) as ReceiptRow[]);
      setStats({
        fridgeCount: fridgeRes.count || 0,
        byCurrency,
        receiptCount: receiptRes.count || 0,
        aiRecipeCount: aiRes.count || 0,
        budgetLimit,
        primaryCurrency,
        expenses: expensesData.map((e) => ({
          amount: Number(e.amount) || 0,
          date: e.date,
          currency: e.currency || 'RUB',
        })),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  const deleteReceipt = async (id: string) => {
    if (!auth) return;
    if (!confirm(t('profile.deleteReceiptConfirm'))) return;
    try {
      await dataApi.receipts.delete(auth, id);
      setRecentReceipts((prev) => prev.filter((r) => r.id !== id));
      setStats((prev) => ({ ...prev, receiptCount: Math.max(0, prev.receiptCount - 1) }));
    } catch {
      alert(t('profile.notifySaveError'));
    }
  };

  const loadHousehold = useCallback(async () => {
    if (!auth) return;
    try {
      const data = await dataApi.household.get(auth);
      setHousehold(data);
    } catch {
      setHousehold(null);
    }
  }, [auth]);

  const loadReferral = useCallback(async () => {
    if (!auth) return;
    try {
      const data = await dataApi.referral.get(auth);
      setReferral(data);
    } catch {
      setReferral(null);
    }
  }, [auth]);

  const inviteFriend = async () => {
    if (!auth || referralBusy) return;
    setReferralBusy(true);
    try {
      const data = referral || (await dataApi.referral.get(auth));
      setReferral(data);
      const link = data.link;
      const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
        .Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('referral.shareText'))}`
        );
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert(t('referral.linkCopied'));
      } else {
        alert(link);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setReferralBusy(false);
    }
  };

  const inviteToFamily = async () => {
    if (!auth || familyBusy) return;
    if (!household?.canInvite) {
      alert(t('family.premiumRequired'));
      return;
    }
    setFamilyBusy(true);
    try {
      const data = await dataApi.household.invite(auth);
      const link = data.link;
      const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
        .Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(
          `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('EatSave — семейный холодильник')}`
        );
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert(t('family.linkCopied'));
      } else {
        alert(link);
      }
      await loadHousehold();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setFamilyBusy(false);
    }
  };

  const leaveFamily = async () => {
    if (!auth || familyBusy) return;
    if (!confirm(t('family.leaveConfirm'))) return;
    setFamilyBusy(true);
    try {
      await dataApi.household.leave(auth);
      await loadHousehold();
      await refreshUser();
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setFamilyBusy(false);
    }
  };

  const removeFamilyMember = async (memberId: number) => {
    if (!auth || familyBusy) return;
    if (!confirm(t('family.removeConfirm'))) return;
    setFamilyBusy(true);
    try {
      await dataApi.household.removeMember(auth, memberId);
      await loadHousehold();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setFamilyBusy(false);
    }
  };

  useEffect(() => {
    loadUserProfile();
    loadStats();
    loadHousehold();
    loadReferral();
  }, [loadUserProfile, loadStats, loadHousehold, loadReferral]);

  useEffect(() => {
    if (!auth) return;
    fetch('/api/admin/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: auth.initData, telegram_user_id: auth.telegram_user_id }),
    })
      .then((res) => res.json())
      .then((data) => setIsAdmin(Boolean(data.admin)))
      .catch(() => setIsAdmin(false));
  }, [auth]);

  const isPremium = hasPremiumAccess(userProfile || dbUser || {});
  const premiumUntil = (userProfile || dbUser)?.premium_until;
  const notificationsEnabled = userProfile?.notifications_enabled !== false;

  const waitForPremium = useCallback(async (attempts = 12) => {
    for (let i = 0; i < attempts; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const profile = await loadUserProfile();
      if (profile?.is_premium) return true;
    }
    return false;
  }, [loadUserProfile]);

  const activatePremiumOnServer = useCallback(async (silent = false) => {
    if (!initData) {
      if (!silent) alert(t('profile.openInTelegram'));
      return false;
    }

    const res = await fetch('/api/premium/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    const data = await res.json();
    if (data.user) {
      setUserProfile(data.user);
      await refreshUser();
      return Boolean(data.user.is_premium);
    }
    if (!res.ok && !silent) {
      alert(data.error || t('profile.activateFail'));
    }

    return false;
  }, [initData, refreshUser, t]);

  const handlePremiumActivated = useCallback(() => {
    alert(t('profile.premiumActivated'));
    window.location.reload();
  }, [t]);

  const recoverPremium = useCallback(async () => {
    setPremiumBusy(true);
    try {
      const ok = await activatePremiumOnServer();
      if (ok) handlePremiumActivated();
    } finally {
      setPremiumBusy(false);
    }
  }, [activatePremiumOnServer, handlePremiumActivated]);

  const toggleNotifications = async () => {
    if (!user?.id || notificationsBusy) return;

    const nextEnabled = !notificationsEnabled;
    setNotificationsBusy(true);
    setUserProfile((prev) =>
      prev ? { ...prev, notifications_enabled: nextEnabled } : prev
    );

    try {
      const endpoint = nextEnabled
        ? '/api/notifications/subscribe'
        : '/api/notifications/unsubscribe';

      const body = nextEnabled
        ? { initData, telegram_user_id: user.id, telegram_chat_id: user.id }
        : { initData, telegram_user_id: user.id };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setUserProfile((prev) =>
          prev ? { ...prev, notifications_enabled: !nextEnabled } : prev
        );
        alert(data.error || t('profile.notifySaveError'));
        return;
      }

      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              notifications_enabled: data.notifications_enabled ?? nextEnabled,
            }
          : prev
      );
    } catch {
      setUserProfile((prev) =>
        prev ? { ...prev, notifications_enabled: !nextEnabled } : prev
      );
      alert(t('common.networkError'));
    } finally {
      setNotificationsBusy(false);
    }
  };

  const changeNotifyHour = async (hour: number) => {
    if (!user?.id || notifyTimeBusy) return;

    const prevHour = userProfile?.notify_hour ?? 12;
    setNotifyTimeBusy(true);
    setUserProfile((prev) => (prev ? { ...prev, notify_hour: hour } : prev));

    let timezone = 'Europe/Moscow';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
    } catch {
      /* keep default */
    }

    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          telegram_user_id: user.id,
          telegram_chat_id: user.id,
          notify_hour: hour,
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserProfile((prev) => (prev ? { ...prev, notify_hour: prevHour } : prev));
        alert(data.error || t('profile.notifySaveError'));
        return;
      }
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              notify_hour: data.notify_hour ?? hour,
              timezone: data.timezone ?? timezone,
            }
          : prev
      );
    } catch {
      setUserProfile((prev) => (prev ? { ...prev, notify_hour: prevHour } : prev));
      alert(t('common.networkError'));
    } finally {
      setNotifyTimeBusy(false);
    }
  };

  const monthName = new Date().toLocaleString(dateLocale, { month: 'long' });
  const monthStartDate = useMemo(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    []
  );

  const achievements = useMemo(
    () =>
      computeAchievements({
        receiptCount: stats.receiptCount,
        aiRecipeCount: stats.aiRecipeCount,
        expenses: stats.expenses,
        budgetLimit: stats.budgetLimit,
        primaryCurrency: stats.primaryCurrency,
        monthStart: monthStartDate,
      }).map((item) => ({
        id: item.id,
        ...ACHIEVEMENT_META[item.id],
        unlocked: item.unlocked,
        current: item.current,
        target: item.target,
      })),
    [stats, monthStartDate]
  );

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const allAchievementsUnlocked = unlockedCount === achievements.length;
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const bonusClaimedThisMonth =
    (userProfile || dbUser)?.achievement_bonus_month === currentMonthKey;

  const claimAchievementBonus = async () => {
    if (!initData || claimBusy) return;
    setClaimBusy(true);
    try {
      const res = await fetch('/api/achievements/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, telegram_user_id: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || t('common.error'));
        return;
      }
      if (data.user) {
        setUserProfile(data.user);
        await refreshUser();
      }
      if (data.alreadyClaimed) {
        alert(t('ach.bonusClaimed'));
      } else {
        alert(t('ach.bonusSuccess', { days: ACHIEVEMENT_BONUS_DAYS }));
      }
    } catch {
      alert(t('common.networkError'));
    } finally {
      setClaimBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('profile.title')} />
      <div className="max-w-mobile mx-auto px-4 py-6 space-y-6">

        <div className="bg-gradient-to-br from-surface/80 to-background border border-accent/20 rounded-3xl p-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -mr-24 -mt-24 pointer-events-none" />
          <div className="flex flex-col items-center text-center relative">
            <div className="w-24 h-24 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-4xl mb-4">
              👤
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {user?.first_name || t('profile.user')}
            </h1>
            {user?.username && (
              <p className="text-accent font-medium mt-1">@{user.username}</p>
            )}
            {isPremium ? (
              <div className="bg-accent/20 rounded-2xl px-5 py-3 border border-accent/50 text-center mt-4">
                <span className="text-accent font-bold text-sm block">{t('profile.premiumActive')}</span>
                <span className="text-xs text-muted mt-1 block">
                  {premiumUntil
                    ? t('profile.premiumUntil', {
                        date: new Date(premiumUntil).toLocaleDateString(dateLocale),
                      })
                    : t('profile.premiumOn')}
                </span>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl px-5 py-3 text-center mt-4">
                <span className="text-muted text-sm block font-medium">{t('profile.standard')}</span>
                <span className="text-xs text-muted/70 mt-1 block">{t('profile.plan')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <p className="text-muted text-sm">{t('common.loading')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">❄️</div>
                <div className="text-3xl font-bold text-accent mb-1">{stats.fridgeCount}</div>
                <div className="text-xs text-muted">{t('profile.products')}</div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">💰</div>
                {Object.keys(stats.byCurrency).length === 0 ? (
                  <div className="text-3xl font-bold text-accent mb-1">0 ₽</div>
                ) : (
                  <div className="space-y-0.5">
                    {Object.entries(stats.byCurrency).map(([cur, amount]) => {
                      const sym = CURRENCY_SYMBOLS[cur] || cur;
                      return (
                        <div key={cur} className="text-2xl font-bold text-accent">
                          {cur === 'RUB' ? amount.toLocaleString() : amount.toFixed(2)} {sym}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="text-xs text-muted">{t('profile.spent')}</div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">🧾</div>
                <div className="text-3xl font-bold text-accent mb-1">{stats.receiptCount}</div>
                <div className="text-xs text-muted">{t('profile.receiptsCount')}</div>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">🍳</div>
                <div className="text-3xl font-bold text-accent mb-1">{stats.aiRecipeCount}</div>
                <div className="text-xs text-muted">{t('profile.aiRecipesCount')}</div>
              </div>
            </div>
          )}
        </div>

        {household && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground text-lg">{t('family.title')}</h2>
            <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm text-muted">
                {t('family.desc', { max: household.maxMembers })}
              </p>
              <p className="text-sm font-medium text-accent">
                {t('family.members', {
                  count: household.memberCount,
                  max: household.maxMembers,
                })}
              </p>
              <div className="space-y-2">
                {household.members.map((m) => (
                  <div
                    key={m.telegram_user_id}
                    className="flex items-center justify-between gap-2 py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {m.first_name || `@${m.username}` || m.telegram_user_id}
                        {m.telegram_user_id === user?.id && ` · ${t('family.you')}`}
                      </div>
                      <div className="text-xs text-muted">
                        {m.role === 'owner' ? t('family.owner') : t('family.member')}
                      </div>
                    </div>
                    {household.role === 'owner' &&
                      m.role !== 'owner' &&
                      m.telegram_user_id !== user?.id && (
                        <button
                          type="button"
                          disabled={familyBusy}
                          onClick={() => removeFamilyMember(m.telegram_user_id)}
                          className="text-xs text-red-400 shrink-0"
                        >
                          {t('family.remove')}
                        </button>
                      )}
                  </div>
                ))}
              </div>
              {household.canInvite && (
                <button
                  type="button"
                  disabled={familyBusy}
                  onClick={inviteToFamily}
                  className="w-full bg-accent text-background font-medium py-3 rounded-xl disabled:opacity-60"
                >
                  {t('family.invite')}
                </button>
              )}
              {household.role === 'member' && (
                <button
                  type="button"
                  disabled={familyBusy}
                  onClick={leaveFamily}
                  className="w-full border border-border text-muted py-3 rounded-xl disabled:opacity-60"
                >
                  {t('family.leave')}
                </button>
              )}
            </div>
          </div>
        )}

        {referral && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground text-lg">{t('referral.title')}</h2>
            <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm text-muted">
                {t('referral.desc', { days: referral.bonusPerInvite || REFERRAL_BONUS_DAYS })}
              </p>
              {referral.milestoneBonusDays && referral.milestoneSize && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 text-sm">
                  <div className="text-accent font-medium">
                    {t('referral.milestone', {
                      count: referral.milestoneSize,
                      days: referral.milestoneBonusDays,
                    })}
                  </div>
                  <div className="text-muted mt-1">
                    {t('referral.milestoneProgress', { n: referral.toNextMilestone ?? referral.milestoneSize })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-accent font-medium">
                  {t('referral.invited', { count: referral.invited })}
                </span>
                <span className="text-muted">·</span>
                <span className="text-accent font-medium">
                  {t('referral.earned', { days: referral.bonusDays })}
                </span>
              </div>
              <button
                type="button"
                disabled={referralBusy}
                onClick={inviteFriend}
                className="w-full bg-accent text-background font-medium py-3 rounded-xl disabled:opacity-60"
              >
                {t('referral.invite')}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground text-lg">
              {t('profile.achievements')}
            </h2>
            {!loading && (
              <span className="text-sm text-muted shrink-0">
                {t('ach.monthProgress', { unlocked: unlockedCount, total: achievements.length })}
              </span>
            )}
          </div>

          {!loading && (
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${(unlockedCount / achievements.length) * 100}%` }}
              />
            </div>
          )}

          {!loading && allAchievementsUnlocked && (
            <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent border border-accent/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <p className="font-bold text-accent">{t('ach.masterTitle')}</p>
                  <p className="text-sm text-muted mt-0.5">{t('ach.masterDesc')}</p>
                </div>
              </div>
              {bonusClaimedThisMonth ? (
                <p className="text-sm text-center text-accent font-medium py-1">
                  {t('ach.bonusClaimed')}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={claimBusy}
                  onClick={claimAchievementBonus}
                  className="w-full bg-accent hover:bg-accent/90 text-background font-bold py-3 rounded-xl transition active:scale-[0.98] disabled:opacity-60"
                >
                  {t('ach.claimBonus')}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl p-4 border text-center transition ${
                  a.unlocked
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-surface border-border opacity-70'
                }`}
              >
                <div className="text-3xl mb-2">{a.icon}</div>
                <div className="text-sm font-semibold">{t(a.titleKey)}</div>
                <div className="text-xs text-muted mt-1">{t(a.descKey)}</div>
                {a.unlocked ? (
                  <span className="inline-block mt-2 text-xs text-accent font-medium">{t('ach.unlocked')}</span>
                ) : (
                  <span className="inline-block mt-2 text-xs text-muted font-medium">
                    {t('ach.progress', { current: a.current, target: a.target })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold text-foreground text-lg">
            {t('profile.settings')}
          </h2>

          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{t('profile.language')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLocale('ru')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    locale === 'ru'
                      ? 'bg-accent text-background'
                      : 'bg-background border border-border text-muted'
                  }`}
                >
                  {t('profile.langRu')}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                    locale === 'en'
                      ? 'bg-accent text-background'
                      : 'bg-background border border-border text-muted'
                  }`}
                >
                  {t('profile.langEn')}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{t('profile.push')}</p>
                <p className="text-sm text-muted mt-1">
                  {t('profile.pushDesc')}
                </p>
              </div>
              <button
                type="button"
                disabled={notificationsBusy}
                onClick={toggleNotifications}
                className={`relative w-14 h-8 rounded-full transition-colors disabled:opacity-60 ${
                  notificationsEnabled ? 'bg-accent' : 'bg-border'
                }`}
                aria-label={notificationsEnabled ? t('profile.notifyDisable') : t('profile.notifyEnable')}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-background transition-transform ${
                    notificationsEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {notificationsEnabled && (
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{t('profile.notifyTime')}</p>
                  <p className="text-sm text-muted mt-1">{t('profile.notifyTimeDesc')}</p>
                </div>
                <select
                  disabled={notifyTimeBusy}
                  value={userProfile?.notify_hour ?? 12}
                  onChange={(e) => changeNotifyHour(Number(e.target.value))}
                  className="bg-background border border-border rounded-xl px-3 py-2 text-foreground font-medium disabled:opacity-60 focus:outline-none focus:border-accent"
                  aria-label={t('profile.notifyTime')}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-lg">{t('profile.receiptHistory')}</h3>
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
            {recentReceipts.length === 0 ? (
              <p className="text-sm text-muted text-center py-2">{t('profile.noReceipts')}</p>
            ) : (
              recentReceipts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {r.store_name || t('profile.receiptItem')}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(r.scanned_at).toLocaleDateString(dateLocale)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-accent shrink-0">
                    {Number(r.total_amount).toLocaleString()}{' '}
                    {CURRENCY_SYMBOLS[r.currency] || r.currency}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteReceipt(r.id)}
                    className="text-muted hover:text-red-400 px-2 py-1 shrink-0"
                    aria-label={t('profile.deleteReceipt')}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-lg">
            {t('profile.info')}
          </h3>
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <span className="text-muted">{t('profile.telegramId')}</span>
              <span className="font-mono text-sm text-accent font-semibold">{user?.id}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-muted">{t('profile.version')}</span>
              <span className="text-sm text-foreground font-medium">v1.0.0</span>
            </div>
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center justify-between py-3 border-t border-border/50 text-accent font-medium"
              >
                <span>📊 Admin</span>
                <span>→</span>
              </Link>
            )}
          </div>
        </div>

        {!isPremium && (
          <div className="space-y-3">
          <button
            disabled={premiumBusy}
            onClick={async (event) => {
              const button = event.currentTarget;
              button.disabled = true;
              setPremiumBusy(true);

              try {
                const res = await fetch('/api/create-premium-invoice', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ initData, telegram_user_id: user?.id }),
                });

                const data = await res.json();

                if (!data.invoiceLink) {
                  alert(data.error || t('profile.invoiceError'));
                  return;
                }

                const tg = (window as {
                  Telegram?: {
                    WebApp: {
                      openInvoice: (link: string, cb: (status: string) => void) => void;
                    };
                  };
                }).Telegram?.WebApp;

                if (!tg?.openInvoice) {
                  alert(t('profile.payTelegramOnly'));
                  return;
                }

                tg.openInvoice(data.invoiceLink, async (status: string) => {
                  if (status === 'paid' || status === 'pending') {
                    if (await waitForPremium(12)) {
                      handlePremiumActivated();
                      return;
                    }
                    const recovered = await activatePremiumOnServer(true);
                    if (recovered || (await waitForPremium(4))) {
                      handlePremiumActivated();
                      return;
                    }
                    alert(t('profile.activateFail'));
                    return;
                  }

                  if (status === 'cancelled') {
                    alert(t('profile.payCancelled'));
                  } else if (status === 'failed') {
                    alert(t('profile.payFail'));
                  }
                });
              } catch {
                alert(t('profile.invoiceCreateFail'));
              } finally {
                button.disabled = false;
                setPremiumBusy(false);
              }
            }}
            className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-background font-bold py-4 rounded-2xl transition-all duration-200 active:scale-95 shadow-lg shadow-accent/30 disabled:opacity-60"
          >
            <span className="flex items-center justify-center gap-2">
              <span>⭐</span> {t('profile.buyPremium', { price: PREMIUM_PRICE_STARS })}
            </span>
          </button>

          <button
            type="button"
            disabled={premiumBusy}
            onClick={recoverPremium}
            className="w-full text-sm text-accent border border-accent/30 rounded-2xl py-3 disabled:opacity-60"
          >
            {t('profile.recoverPremium')}
          </button>
          </div>
        )}

        {isPremium && userProfile?.premium_until && (
          <p className="text-center text-sm text-muted">
            {t('profile.subUntil')}{' '}
            {new Date(userProfile.premium_until).toLocaleDateString(dateLocale)}
          </p>
        )}

        <div className="bg-surface/60 border border-accent/10 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-muted leading-relaxed">
            <span className="text-accent font-semibold">{t('profile.about')}</span>
          </p>
          <p className="text-sm text-muted/80 leading-relaxed">
            {t('profile.aboutText')}
          </p>
        </div>

      </div>
    </main>
  );
}

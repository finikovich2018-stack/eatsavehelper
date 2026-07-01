'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useTelegram } from '@/components/TelegramProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { dataApi } from '@/lib/client-api';
import { useDataAuth } from '@/lib/use-data-auth';
import { FREE_FRIDGE_ITEMS, FREE_SCANS_PER_MONTH } from '@/lib/constants';
import { hasPremiumAccess } from '@/lib/user-utils';
import { formatLocalDate } from '@/lib/utils';

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', CNY: '¥', JPY: '¥', INR: '₹',
};

type ParsedItem = {
  name: string;
  quantity?: number;
  price?: number;
  expiry_days?: number;
  category?: string;
  icon?: string;
};

// Fallback shelf life (days) by product type when the receipt doesn't specify one.
const CATEGORY_EXPIRY: Record<string, number> = {
  dairy: 7, meat: 3, veg: 5, grains: 30, other: 7,
};

function defaultExpiryDays(item: ParsedItem) {
  if (item.expiry_days && item.expiry_days > 0) return item.expiry_days;
  return CATEGORY_EXPIRY[item.category || 'other'] ?? 7;
}

export default function ScanPage() {
  const auth = useDataAuth();
  const { user, dbUser, initData, refreshUser } = useTelegram();
  const { t, dateLocale } = useI18n();
  const testUserId = user?.id;
  const [userProfile, setUserProfile] = useState<any>(null);
  const isPremium = hasPremiumAccess(userProfile || dbUser || {});
  const [fridgeCount, setFridgeCount] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [currency, setCurrency] = useState<string>('RUB');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadFridgeCount = useCallback(async () => {
    if (!auth) return 0;
    const { count } = await dataApi.fridge.count(auth);
    const n = count || 0;
    setFridgeCount(n);
    return n;
  }, [auth]);

  useEffect(() => {
    if (auth) loadFridgeCount();
  }, [auth, loadFridgeCount]);

  useEffect(() => {
    if (auth && items.length > 0) loadFridgeCount();
  }, [auth, items.length, loadFridgeCount]);

  const slotsLeft = isPremium ? Infinity : Math.max(0, FREE_FRIDGE_ITEMS - fridgeCount);
  const itemsToAdd = isPremium ? items.length : Math.min(items.length, slotsLeft);
  const fridgeFull = !isPremium && slotsLeft === 0;
  const willPartialSave = !isPremium && items.length > slotsLeft && slotsLeft > 0;

  useEffect(() => {
    if (!testUserId) return;
    refreshUser().then((profile) => {
      if (profile) setUserProfile(profile);
    });
  }, [testUserId, refreshUser]);

  const scansLeft = isPremium
    ? '∞'
    : Math.max(0, FREE_SCANS_PER_MONTH - (userProfile?.scans_this_month || 0));
  const canScan =
    isPremium || (userProfile?.scans_this_month || 0) < FREE_SCANS_PER_MONTH;

  const openGallery = () => {
    if (!canScan) {
      alert(t('scan.limitAlert', { limit: FREE_SCANS_PER_MONTH }));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: Event) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            })
        )
      ).then((imgs) => {
        setImages(imgs);
        setItems([]);
        setSaved(false);
        setCurrency('RUB');
      });
    };
    input.click();
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const parseReceipt = async () => {
    if (images.length === 0) return;
    setLoading(true);
    const collected: ParsedItem[] = [];
    let detectedCurrency = '';
    let processed = 0;
    try {
      for (const img of images) {
        const res = await fetch('/api/ai/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: img,
            initData,
            telegram_user_id: testUserId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) {
            if (processed === 0) {
              alert(t('scan.limitAlert', { limit: FREE_SCANS_PER_MONTH }));
              return;
            }
            alert(t('scan.limitAlert', { limit: FREE_SCANS_PER_MONTH }));
            break;
          }
          throw new Error(data.details || data.error || t('common.error'));
        }
        collected.push(...((data.items || []) as ParsedItem[]));
        if (!detectedCurrency && data.currency) detectedCurrency = data.currency;
        processed += 1;
        setUserProfile((prev: any) =>
          prev
            ? {
                ...prev,
                scans_this_month: data.scans_this_month ?? (prev.scans_this_month || 0) + 1,
              }
            : prev
        );
      }

      setItems(collected);
      if (detectedCurrency) setCurrency(detectedCurrency);
      refreshUser().then((profile) => {
        if (profile) setUserProfile(profile);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error');
      alert(t('scan.parseError', { msg: message }));
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof ParsedItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addToFridge = async () => {
    if (!auth || items.length === 0) return;
    setSaving(true);
    try {
      let currentCount = fridgeCount;
      if (!isPremium) {
        currentCount = await loadFridgeCount();
        const left = Math.max(0, FREE_FRIDGE_ITEMS - currentCount);
        if (left === 0 && !isPremium) {
          alert(t('fridge.limitAlert', { limit: FREE_FRIDGE_ITEMS }));
          return;
        }
      }

      const batch = isPremium ? items : items.slice(0, Math.max(0, FREE_FRIDGE_ITEMS - currentCount));
      if (batch.length === 0) {
        alert(t('scan.fridgeFull', { limit: FREE_FRIDGE_ITEMS }));
        return;
      }

      const rows = batch.map((item) => {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + defaultExpiryDays(item));
        const unitPrice = parseFloat(String(item.price)) || 0;
        return {
          name: item.name,
          category: item.category || 'other',
          quantity: t('scan.quantityUnit', { n: item.quantity || 1 }),
          expiry_date: formatLocalDate(expiryDate),
          icon: item.icon || '📦',
          price: unitPrice,
          currency,
        };
      });
      await dataApi.fridge.insert(auth, rows);

      const totalAmount = batch.reduce((sum, item) => sum + (parseFloat(String(item.price)) || 0), 0);
      const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
      const today = formatLocalDate();

      await dataApi.receipts.insert(auth, {
        total_amount: totalAmount,
        currency,
        store_name: t('scan.receiptStore', {
          date: new Date().toLocaleDateString(dateLocale),
        }),
      });

      await dataApi.expenses.insert(auth, {
        name: t('scan.receiptExpense', { symbol: currencySymbol }),
        amount: totalAmount,
        date: today,
        category: '🛒',
        currency,
      });

      const remainingItems = items.slice(batch.length);
      if (remainingItems.length > 0) {
        setItems(remainingItems);
        setFridgeCount(currentCount + batch.length);
        alert(t('scan.partialSaved', { added: batch.length, total: batch.length + remainingItems.length }));
      } else {
        setSaved(true);
        setItems([]);
        setImages([]);
        setFridgeCount(currentCount + batch.length);
      }
    } catch {
      alert(t('scan.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title={t('scan.title')} />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="mb-4 text-sm text-muted">
          {isPremium ? (
            <span className="text-accent">{t('scan.premiumUnlimited')}</span>
          ) : (
            <span>
              {t('scan.scansLeft')}{' '}
              <span className={Number(scansLeft) === 0 ? 'text-red-400' : 'text-accent'}>
                {scansLeft}/{FREE_SCANS_PER_MONTH}
              </span>
            </span>
          )}
        </div>

        <button
          onClick={openGallery}
          className={`w-full py-5 rounded-3xl text-lg font-medium transition ${
            canScan
              ? 'bg-surface border border-border hover:border-accent/50'
              : 'bg-surface border border-border text-muted cursor-not-allowed'
          }`}
        >
          {canScan ? t('scan.pickGallery') : t('scan.limitLocked')}
        </button>

        {saved && (
          <div className="mt-6 bg-accent/10 border border-accent/30 rounded-2xl p-4 text-center text-accent font-medium">
            {t('scan.savedSuccess')}
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-6">
            {images.length > 1 && (
              <p className="text-xs text-muted mb-2">
                {t('scan.receiptsSelected', { count: images.length })}
              </p>
            )}
            <div className={images.length > 1 ? 'grid grid-cols-2 gap-2 mb-4' : 'mb-4'}>
              {images.map((img, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    className="w-full rounded-2xl border border-border"
                    alt={t('scan.receiptAlt')}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={parseReceipt}
              disabled={loading}
              className="w-full bg-accent text-background py-4 rounded-3xl font-medium text-lg disabled:opacity-50"
            >
              {loading ? t('scan.analyzing') : t('scan.recognize')}
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-6 bg-surface border border-border rounded-3xl p-5">
            <h2 className="font-semibold mb-4">
              {t('scan.found', { count: items.length })}{' '}
              <span className="text-accent">{currency}</span>
            </h2>
            <p className="text-xs text-muted mb-4">{t('scan.reviewHint')}</p>
            {!isPremium && (
              <p className={`text-xs mb-4 ${fridgeFull ? 'text-red-400' : willPartialSave ? 'text-yellow-400' : 'text-muted'}`}>
                {fridgeFull
                  ? t('scan.fridgeFull', { limit: FREE_FRIDGE_ITEMS })
                  : t('scan.fridgeSlots', { current: fridgeCount, limit: FREE_FRIDGE_ITEMS })}
              </p>
            )}
            <div className="space-y-3 mb-4">
              {items.map((item, i) => {
                const symbol = CURRENCY_SYMBOLS[currency] || currency;
                return (
                  <div key={i} className="bg-background border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0">{item.icon || '📦'}</span>
                      <input
                        className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none min-w-0"
                        value={item.name}
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-muted hover:text-red-400 px-2 shrink-0"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative w-1/2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={t('scan.price')}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-8 text-sm outline-none"
                          value={item.price ?? ''}
                          onChange={(e) => updateItem(i, 'price', parseFloat(e.target.value) || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                          {symbol}
                        </span>
                      </div>
                      <div className="relative w-1/2">
                        <input
                          type="number"
                          min={1}
                          placeholder={t('scan.expiryDays')}
                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-10 text-sm outline-none"
                          value={item.expiry_days ?? defaultExpiryDays(item)}
                          onChange={(e) => updateItem(i, 'expiry_days', parseInt(e.target.value, 10) || 7)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                          {t('scan.daysShort')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addToFridge}
              disabled={saving || fridgeFull}
              className="w-full bg-accent text-background py-4 rounded-2xl font-medium text-lg disabled:opacity-50"
            >
              {saving
                ? t('scan.saving')
                : !isPremium && itemsToAdd < items.length
                  ? t('scan.addCount', { count: itemsToAdd })
                  : t('scan.addAll')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

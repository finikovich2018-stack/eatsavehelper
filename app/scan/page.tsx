'use client';

import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { useTelegram } from '@/components/TelegramProvider';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { supabase } from '@/lib/supabase/client';
import { FREE_SCANS_PER_MONTH } from '@/lib/constants';

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

export default function ScanPage() {
  const { user } = useTelegram();
  const { t, dateLocale } = useI18n();
  const testUserId = user?.id;
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [currency, setCurrency] = useState<string>('RUB');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (testUserId) {
      fetch('/api/user/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: testUserId }),
      })
        .then((r) => r.json())
        .then((d) => setUserProfile(d.user));
    }
  }, [testUserId]);

  const scansLeft = userProfile?.is_premium
    ? '∞'
    : Math.max(0, FREE_SCANS_PER_MONTH - (userProfile?.scans_this_month || 0));
  const canScan =
    userProfile?.is_premium || (userProfile?.scans_this_month || 0) < FREE_SCANS_PER_MONTH;

  const openGallery = () => {
    if (!canScan) {
      alert(t('scan.limitAlert', { limit: FREE_SCANS_PER_MONTH }));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
      setItems([]);
      setSaved(false);
      setCurrency('RUB');
    };
    input.click();
  };

  const parseReceipt = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          telegram_user_id: testUserId,
          is_premium: userProfile?.is_premium,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          alert(t('scan.limitAlert', { limit: FREE_SCANS_PER_MONTH }));
          return;
        }
        throw new Error(data.details || data.error || t('common.error'));
      }
      setItems(data.items || []);
      if (data.currency) setCurrency(data.currency);

      const incRes = await fetch('/api/user/increment-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: testUserId }),
      });
      const incData = await incRes.json();
      setUserProfile((prev: any) =>
        prev ? { ...prev, scans_this_month: incData.scans_this_month || (prev.scans_this_month || 0) + 1 } : prev
      );
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
    if (!testUserId || items.length === 0) return;
    setSaving(true);
    try {
      const rows = items.map((item) => {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (item.expiry_days || 7));
        return {
          name: item.name,
          category: item.category || 'other',
          quantity: t('scan.quantityUnit', { n: item.quantity || 1 }),
          expiry_date: expiryDate.toISOString().split('T')[0],
          icon: item.icon || '📦',
          telegram_user_id: testUserId,
        };
      });
      const { error } = await supabase.from('fridge_items').insert(rows);
      if (error) throw error;

      const totalAmount = items.reduce((sum, item) => sum + (parseFloat(String(item.price)) || 0), 0);
      const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

      await supabase.from('receipts').insert({
        telegram_user_id: testUserId,
        total_amount: totalAmount,
        currency,
        store_name: `Чек ${new Date().toLocaleDateString(dateLocale)}`,
      });

      await supabase.from('expenses').insert({
        name: `🧾 Покупка по чеку (${currencySymbol})`,
        amount: totalAmount,
        date: new Date().toISOString().split('T')[0],
        category: '🛒',
        currency,
        telegram_user_id: testUserId,
      });

      setSaved(true);
      setItems([]);
      setImage(null);
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
          {userProfile?.is_premium ? (
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

        {image && (
          <div className="mt-6">
            <img src={image} className="w-full rounded-2xl mb-4 border border-border" alt={t('scan.receiptAlt')} />
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
            <div className="space-y-3 mb-4">
              {items.map((item, i) => (
                <div key={i} className="bg-background border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none"
                      value={item.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                    />
                    <button onClick={() => removeItem(i)} className="text-muted hover:text-red-400 px-2">✕</button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={t('scan.price')}
                      className="w-1/2 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none"
                      value={item.price ?? ''}
                      onChange={(e) => updateItem(i, 'price', parseFloat(e.target.value) || 0)}
                    />
                    <input
                      type="number"
                      placeholder={t('scan.expiryDays')}
                      className="w-1/2 bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none"
                      value={item.expiry_days ?? 7}
                      onChange={(e) => updateItem(i, 'expiry_days', parseInt(e.target.value, 10) || 7)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addToFridge}
              disabled={saving}
              className="w-full bg-accent text-background py-4 rounded-2xl font-medium text-lg disabled:opacity-50"
            >
              {saving ? t('scan.saving') : t('scan.addAll')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

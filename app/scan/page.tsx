'use client';

import { useState, useEffect } from "react";
import { useTelegram } from '@/components/TelegramProvider';
import { supabase } from '@/lib/supabase/client';

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '?', USD: '$', EUR: '�', GBP: '?', UAH: '?', KZT: '?',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', CNY: '?', JPY: '?', INR: '?',
};

const FREE_SCAN_LIMIT = 3;

export default function ScanPage() {
  const { user } = useTelegram();
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [currency, setCurrency] = useState<string>('RUB');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const testUserId = user?.id || 1781382847257;
if (testUserId) {
      fetch('/api/user/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: testUserId }),
      })
        .then(r => r.json())
        .then(d => setUserProfile(d.user));
    }
  }, [user?.id]);

  const scansLeft = userProfile?.is_premium
    ? '?'
    : Math.max(0, FREE_SCAN_LIMIT - (userProfile?.scans_this_month || 0));
  const canScan = userProfile?.is_premium || (userProfile?.scans_this_month || 0) < FREE_SCAN_LIMIT;

  const openGallery = () => {
    if (!canScan) {
      alert(`���������� �����: ${FREE_SCAN_LIMIT} �����/�����. ������ Premium ��� ����������� ������!`);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
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
      const res = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      const parsedItems = data.items || [];
      setItems(parsedItems);
      if (data.currency) setCurrency(data.currency);

      // ����������� ������� ������
      await fetch('/api/user/increment-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_user_id: testUserId }),
      });
      setUserProfile((prev: any) => prev ? { ...prev, scans_this_month: (prev.scans_this_month || 0) + 1 } : prev);
    } catch {
      alert("������ ��� �������������.");
    } finally {
      setLoading(false);
    }
  };

  const addToFridge = async () => {
    if (!user?.id || items.length === 0) return;
    setSaving(true);
    try {
      const rows = items.map(item => {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (item.expiry_days || 7));
        return {
          name: item.name,
          category: item.category || 'other',
          quantity: `${item.quantity || 1} ��.`,
          expiry_date: expiryDate.toISOString().split('T')[0],
          icon: item.icon || '??',
          telegram_user_id: testUserId,
        };
      });
      const { error } = await supabase.from('fridge_items').insert(rows);
      if (error) throw error;

      const totalAmount = items.reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
      const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
      await supabase.from('expenses').insert({
        name: `?? ������� �� ���� (${currencySymbol})`,
        amount: totalAmount,
        date: new Date().toISOString().split('T')[0],
        category: '??',
        currency: currency,
        telegram_user_id: testUserId,
      });

      setSaved(true);
      setItems([]);
      setImage(null);
    } catch {
      alert("������ ��� ����������.");
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

  return (
    <main className="max-w-md mx-auto px-4 py-6 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-2">?? ������ ����</h1>

      {/* ������� ������ */}
      <div className="mb-4 text-sm text-zinc-400">
        {userProfile?.is_premium ? (
          <span className="text-yellow-400">? Premium � ����������� �����</span>
        ) : (
          <span>�������� ������: <span className={Number(scansLeft) === 0 ? 'text-red-400' : 'text-emerald-400'}>{scansLeft}/{FREE_SCAN_LIMIT}</span></span>
        )}
      </div>

      <button onClick={openGallery}
        className={`w-full py-5 rounded-3xl text-lg font-medium ${canScan ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
        {canScan ? '?? ������� �� �������' : '?? ����� �������� � ����� Premium'}
      </button>

      {saved && (
        <div className="mt-6 bg-emerald-900 rounded-2xl p-4 text-center text-emerald-300 font-medium">
          ? �������� ��������� � �����������!
        </div>
      )}

      {image && (
        <div className="mt-6">
          <img src={image} className="w-full rounded-2xl mb-4" alt="���" />
          <button onClick={parseReceipt} disabled={loading}
            className="w-full bg-emerald-600 py-4 rounded-3xl font-medium text-lg disabled:bg-zinc-700">
            {loading ? "?? ���������..." : "?? ���������� ���"}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 bg-zinc-900 rounded-3xl p-5">
          <h2 className="font-semibold mb-4">
            ? ������� �������: {items.length} � <span className="text-emerald-400">{currency}</span>
          </h2>
          {items.map((item, i) => (
            <div key={i} className="py-2 border-b border-zinc-700 last:border-0 flex justify-between">
              <span>{item.icon} {item.name}</span>
              <span className="text-zinc-400">{item.price} {currencySymbol}</span>
            </div>
          ))}
          <button onClick={addToFridge} disabled={saving}
            className="w-full mt-4 bg-emerald-600 py-4 rounded-2xl font-medium text-lg disabled:bg-zinc-700">
            {saving ? "��������..." : "? �������� �� � �����������"}
          </button>
        </div>
      )}
    </main>
  );
}




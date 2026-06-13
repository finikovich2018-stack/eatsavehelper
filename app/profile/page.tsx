'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸', AUD: 'A$', CAD: 'C$',
};

type Stats = {
  fridgeCount: number;
  byCurrency: Record<string, number>;
};

export default function ProfilePage() {
  const { user } = useTelegram();
  const [stats, setStats] = useState<Stats>({ fridgeCount: 0, byCurrency: {} });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { count: fridgeCount } = await supabase
        .from('fridge_items')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', user.id);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount, currency')
        .eq('telegram_user_id', user.id)
        .gte('date', monthStart);

      const byCurrency: Record<string, number> = {};
      expensesData?.forEach(e => {
        const cur = (e as any).currency || 'RUB';
        byCurrency[cur] = (byCurrency[cur] || 0) + (Number(e.amount) || 0);
      });

      setStats({
        fridgeCount: fridgeCount || 0,
        byCurrency,
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const monthName = new Date().toLocaleString('ru-RU', { month: 'long' });

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="👤 Профиль" />
      <div className="max-w-mobile mx-auto px-4 py-8 space-y-8">

                        {/* Кнопка Premium */}
        {!user?.is_premium && (
          <button
            onClick={async () => {
              try {
                // @ts-ignore
                const button = event?.currentTarget;
                if (button) button.disabled = true;

                const res = await fetch("/api/create-premium-invoice", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user?.id }),
                });

                const data = await res.json();

                if (data.invoiceLink) {
                  // @ts-ignore
                  window.Telegram.WebApp.openInvoice(data.invoiceLink, (status: string) => {
                    if (status === "paid") {
                      alert("✅ Спасибо! Premium активирован.");
                      window.location.reload();
                    } else if (status === "cancelled") {
                      alert("Оплата отменена");
                    } else if (status === "failed") {
                      alert("Ошибка оплаты. Попробуйте ещё раз.");
                    }
                  });
                } else {
                  alert(data.error || "Ошибка при создании счёта");
                }
              } catch (error) {
                alert("Не удалось создать счёт");
              } finally {
                // @ts-ignore
                if (event?.currentTarget) event.currentTarget.disabled = false;
              }
            }}
            className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-background font-bold py-4 rounded-2xl transition-all duration-200 active:scale-95 shadow-lg shadow-accent/30 disabled:opacity-60"
          >
            <span className="flex items-center justify-center gap-2">
              <span>⭐</span> Купить Premium за 149 Stars
            </span>
          </button>
        )}
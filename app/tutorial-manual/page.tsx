'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import { CAT_LABELS, DEMO_FRIDGE, daysLeft } from '@/lib/marketing-demo-data';

const STEPS = [
  { caption: 'Откройте @EatSavehelper_bot → «Открыть EatSave»', hint: 'Чек не обязателен' },
  { caption: 'Внизу нажмите «Холод.»', hint: 'Или на главной — «Добавить продукт»' },
  { caption: 'Нажмите «➕ Добавить»', hint: 'Ручной ввод без скана' },
  { caption: 'Заполните поля и нажмите «Сохранить»', hint: 'Молоко · Молочное · 1 л · дата с упаковки' },
  { caption: 'Готово — продукт в списке!', hint: 'EatSave напомнит о сроке годности' },
] as const;

function Ring({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <div className="rounded-2xl ring-4 ring-accent ring-offset-2 ring-offset-background shadow-[0_0_24px_rgba(126,217,87,0.35)]">
      {children}
    </div>
  );
}

function TutorialBanner({ step }: { step: number }) {
  const meta = STEPS[step - 1];
  return (
    <div className="sticky top-0 z-40 border-b border-accent/30 bg-[#0c0f0a]/95 backdrop-blur px-4 py-3">
      <div className="max-w-mobile mx-auto">
        <div className="text-[11px] font-semibold text-accent uppercase tracking-wide">
          EatSave · шаг {step} из 5
        </div>
        <div className="text-sm font-bold text-foreground mt-1 leading-snug">{meta.caption}</div>
        <div className="text-xs text-muted mt-1">{meta.hint}</div>
      </div>
    </div>
  );
}

function TutorialBottomNav({ activeTab, ringTab }: { activeTab: string; ringTab?: string }) {
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Главная' },
    { id: 'fridge', icon: '❄️', label: 'Холод.' },
    { id: 'shop', icon: '🛒', label: 'Покупки' },
    { id: 'recipes', icon: '👨‍🍳', label: 'Рецепты' },
    { id: 'scan', icon: '📷', label: 'Сканер' },
    { id: 'budget', icon: '💰', label: 'Бюджет' },
    { id: 'profile', icon: '👤', label: 'Профиль' },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-mobile -translate-x-1/2 border-t border-border bg-surface px-1 pb-safe">
      <ul className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const ring = tab.id === ringTab;
          return (
            <li key={tab.id}>
              <Ring on={ring}>
                <div
                  className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] ${
                    isActive ? 'text-accent opacity-100' : 'text-muted opacity-60'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              </Ring>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TutorialContent() {
  const searchParams = useSearchParams();
  const step = Math.min(5, Math.max(1, Number(searchParams.get('step') || '1')));
  const demoDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

  if (step === 1) {
    return (
      <main className="min-h-screen bg-[#17212b] text-white pb-24">
        <TutorialBanner step={1} />
        <div className="max-w-mobile mx-auto px-4 pt-10 text-center">
          <img
            src="/eatsave-logo.png"
            alt="EatSave"
            width={96}
            height={96}
            className="w-24 h-24 mx-auto rounded-[18px] object-cover object-[center_22%] mb-4 shadow-lg"
          />
          <h1 className="text-2xl font-bold">EatSave</h1>
          <p className="text-[#8b9bab] text-sm mt-1">@EatSavehelper_bot</p>
          <p className="text-[#8b9bab] text-xs mt-3 px-6">
            Умный холодильник + бюджет. Скан чеков, AI-рецепты.
          </p>
          <div className="mt-8 px-2">
            <Ring on>
              <button
                type="button"
                className="w-full bg-[#2481cc] text-white py-3.5 rounded-xl font-semibold text-base"
              >
                Открыть EatSave
              </button>
            </Ring>
          </div>
        </div>
      </main>
    );
  }

  if (step === 2) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-24">
        <TutorialBanner step={2} />
        <TopBar title="EatSave" />
        <div className="max-w-mobile mx-auto px-4 py-4 space-y-6">
          <div className="bg-gradient-to-br from-surface to-background border border-border rounded-3xl p-5">
            <div className="text-xs text-muted">Бюджет на {new Date().toLocaleString('ru-RU', { month: 'long' })}</div>
            <div className="text-2xl font-bold mt-1">4 200 / 15 000 ₽</div>
          </div>
          <div>
            <h2 className="font-semibold mb-3">Быстрые действия</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-border rounded-2xl p-4 text-center opacity-50">
                <div className="text-2xl mb-1">📷</div>
                Скан чека
              </div>
              <Ring on>
                <div className="bg-surface border border-border rounded-2xl p-4 text-center font-medium">
                  <div className="text-2xl mb-1">➕</div>
                  Добавить продукт
                </div>
              </Ring>
            </div>
          </div>
        </div>
        <TutorialBottomNav activeTab="home" ringTab="fridge" />
      </main>
    );
  }

  const showForm = step === 3 || step === 4;
  const showSaved = step === 5;
  const milk = { name: 'Молоко', quantity: '1 л', category: 'dairy' as const, icon: '🥛', expiry_date: demoDate };

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TutorialBanner step={step} />
      <TopBar title="Холодильник" />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Ring on={step === 3}>
            <button
              type="button"
              className="w-full bg-accent text-background py-3 rounded-2xl font-medium text-sm"
            >
              ➕ Добавить
            </button>
          </Ring>
          <Link
            href="/scan"
            className="bg-surface border border-border py-3 rounded-2xl font-medium text-center text-sm opacity-50 pointer-events-none"
          >
            📷 Скан чека
          </Link>
          <div className="bg-surface border border-accent/40 py-3 rounded-2xl font-medium text-center text-sm text-accent opacity-50">
            🛒 Покупки
          </div>
        </div>

        {showForm && (
          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <input
              readOnly
              value={step >= 4 ? milk.name : ''}
              placeholder="Название продукта"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none placeholder-muted"
            />
            <select
              disabled
              value={step >= 4 ? milk.category : 'other'}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
            >
              <option value="dairy">🥛 Молочное</option>
            </select>
            <input
              readOnly
              value={step >= 4 ? milk.quantity : ''}
              placeholder="Количество (1л, 500г...)"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none placeholder-muted"
            />
            <input
              readOnly
              type="date"
              value={step >= 4 ? milk.expiry_date : ''}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none"
            />
            <Ring on={step === 4}>
              <button type="button" className="w-full bg-accent text-background py-3 rounded-xl font-medium">
                Сохранить
              </button>
            </Ring>
          </div>
        )}

        <div className="space-y-3">
          {(showSaved ? [milk, ...DEMO_FRIDGE.slice(0, 2)] : DEMO_FRIDGE.slice(0, 2)).map((item, idx) => {
            const days = daysLeft(item.expiry_date);
            const isNew = showSaved && idx === 0;
            return (
              <div
                key={`${item.name}-${idx}`}
                className={`bg-surface border rounded-2xl p-4 flex items-center gap-3 ${
                  isNew ? 'border-accent/60 ring-2 ring-accent/40' : 'border-border'
                }`}
              >
                <span className="text-3xl">{item.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {item.quantity} · {CAT_LABELS[item.category as keyof typeof CAT_LABELS] || 'Другое'}
                  </div>
                  <div className="text-xs mt-1 font-medium text-accent">
                    {days <= 1 ? '⚠️ Сегодня истекает' : `📅 Ещё ${days} дн.`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <TutorialBottomNav activeTab="fridge" />
    </main>
  );
}

export default function TutorialManualPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <TutorialContent />
    </Suspense>
  );
}

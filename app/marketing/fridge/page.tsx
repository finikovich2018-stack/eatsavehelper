import TopBar from '@/components/layout/TopBar';
import Link from 'next/link';
import { CAT_LABELS, DEMO_FRIDGE, daysLeft } from '@/lib/marketing-demo-data';

function expiryColor(days: number) {
  if (days <= 1) return 'text-red-400';
  if (days <= 3) return 'text-yellow-400';
  return 'text-accent';
}

export default function MarketingFridgePage() {
  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="Холодильник" />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button type="button" className="bg-accent text-background py-3 rounded-2xl font-medium">
            ➕ Добавить
          </button>
          <Link href="/marketing/scan" className="bg-surface border border-border py-3 rounded-2xl font-medium text-center">
            📷 Скан чека
          </Link>
        </div>

        <input
          readOnly
          placeholder="Поиск продуктов..."
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 placeholder-muted outline-none mb-3"
        />

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {Object.entries(CAT_LABELS).map(([key, label]) => (
            <span
              key={key}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium ${
                key === 'all' ? 'bg-accent text-background' : 'bg-surface border border-border text-muted'
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-accent">{DEMO_FRIDGE.length}</div>
            <div className="text-xs text-muted mt-1">Продуктов</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-red-400">1</div>
            <div className="text-xs text-muted mt-1">Сегодня</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">3</div>
            <div className="text-xs text-muted mt-1">Скоро</div>
          </div>
        </div>

        <div className="space-y-3">
          {DEMO_FRIDGE.map((item) => {
            const days = daysLeft(item.expiry_date);
            return (
              <div key={item.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
                <span className="text-3xl">{item.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {item.quantity} · {CAT_LABELS[item.category] || 'Другое'}
                  </div>
                  <div className={`text-xs mt-1 font-medium ${expiryColor(days)}`}>
                    {days <= 0 ? 'Просрочено' : days === 1 ? '⚠️ Сегодня истекает' : `📅 Ещё ${days} дн.`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

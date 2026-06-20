import TopBar from '@/components/layout/TopBar';
import Link from 'next/link';
import {
  DEMO_BUDGET,
  DEMO_FRIDGE,
  DEMO_STATS,
  daysLeft,
} from '@/lib/marketing-demo-data';

export default function MarketingHomePage() {
  const expiring = DEMO_FRIDGE.filter((item) => {
    const days = daysLeft(item.expiry_date);
    return days >= 0 && days <= 3;
  }).slice(0, 5);

  const symbol = '₽';
  const percent = Math.min((DEMO_BUDGET.spent / DEMO_BUDGET.limit) * 100, 100);
  const remaining = DEMO_BUDGET.limit - DEMO_BUDGET.spent;
  const monthName = new Date().toLocaleString('ru-RU', { month: 'long' });

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="EatSave" />
      <div className="max-w-mobile mx-auto px-4 py-4 space-y-6">
        <div className="bg-gradient-to-br from-surface to-background border border-border rounded-3xl p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs text-muted">Бюджет на {monthName}</div>
              <div className="text-2xl font-bold mt-1">
                {DEMO_BUDGET.spent.toLocaleString()} / {DEMO_BUDGET.limit.toLocaleString()} {symbol}
              </div>
            </div>
            <Link href="/marketing/budget" className="text-xs text-accent font-medium">Изменить</Link>
          </div>
          <div className="bg-background/60 rounded-full h-3 mb-2">
            <div className="h-3 rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="text-xs text-muted">
            Осталось {remaining.toLocaleString()} {symbol}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">⚠️ Скоро испортится</h2>
            <Link href="/marketing/fridge" className="text-xs text-accent">Все</Link>
          </div>
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
                  <span className={`text-xs font-semibold ${days <= 1 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {days <= 1 ? 'Сегодня' : `${days} дн.`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Быстрые действия</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/marketing/scan" className="bg-accent text-background rounded-2xl p-4 text-center font-medium">
              <div className="text-2xl mb-1">📷</div>
              Скан чека
            </Link>
            <Link href="/marketing/fridge" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium">
              <div className="text-2xl mb-1">➕</div>
              Добавить продукт
            </Link>
            <Link href="/marketing/recipes" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium">
              <div className="text-2xl mb-1">👨‍🍳</div>
              Рецепты
            </Link>
            <Link href="/marketing/profile" className="bg-surface border border-border rounded-2xl p-4 text-center font-medium">
              <div className="text-2xl mb-1">📊</div>
              Статистика
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-accent">{DEMO_STATS.fridgeCount}</div>
            <div className="text-xs text-muted mt-1">Продуктов</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-yellow-400">3</div>
            <div className="text-xs text-muted mt-1">Истекают</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-accent">{DEMO_STATS.aiRecipeCount}</div>
            <div className="text-xs text-muted mt-1">AI-рецептов</div>
          </div>
        </div>
      </div>
    </main>
  );
}

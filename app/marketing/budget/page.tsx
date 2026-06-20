import TopBar from '@/components/layout/TopBar';
import { DEMO_BUDGET, DEMO_EXPENSES, DEMO_WEEKLY } from '@/lib/marketing-demo-data';

export default function MarketingBudgetPage() {
  const percent = Math.min((DEMO_BUDGET.spent / DEMO_BUDGET.limit) * 100, 100);
  const remaining = DEMO_BUDGET.limit - DEMO_BUDGET.spent;
  const maxWeekly = Math.max(...DEMO_WEEKLY.map((d) => d.total), 1);

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="Бюджет" />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="bg-gradient-to-br from-surface to-background border border-border rounded-2xl p-5 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-xs text-muted">Потрачено в RUB</div>
              <div className="text-3xl font-bold mt-1">
                {DEMO_BUDGET.spent.toLocaleString()} ₽
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Лимит</div>
              <div className="text-lg font-medium mt-1">
                {DEMO_BUDGET.limit.toLocaleString()} ₽
              </div>
            </div>
          </div>
          <div className="bg-background/60 rounded-full h-3 mb-2">
            <div className="h-3 rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Использовано {percent.toFixed(0)}%</span>
            <span className="text-accent">Осталось {remaining.toLocaleString()} ₽</span>
          </div>
        </div>

        <div className="bg-accent/10 border border-accent/30 rounded-2xl p-4 mb-4 text-center">
          <span className="text-sm text-muted">Экономия до конца месяца: </span>
          <span className="text-accent font-bold">{remaining.toLocaleString()} ₽</span>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-medium text-muted mb-3">📊 Расходы за 7 дней</h3>
          <div className="flex items-end justify-between gap-1 h-24">
            {DEMO_WEEKLY.map((day) => (
              <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-accent/80 rounded-t-md min-h-[4px]"
                  style={{ height: `${Math.max((day.total / maxWeekly) * 100, 8)}%` }}
                />
                <span className="text-[10px] text-muted">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="w-full bg-accent text-background py-3 rounded-2xl font-medium mb-4">
          ➕ Добавить расход
        </button>

        <h2 className="text-sm font-medium text-muted mb-3">История расходов</h2>
        <div className="space-y-3">
          {DEMO_EXPENSES.map((exp) => (
            <div key={exp.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">{exp.category}</span>
              <div className="flex-1">
                <div className="font-medium">{exp.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  {new Date(exp.date).toLocaleDateString('ru-RU')}
                </div>
              </div>
              <div className="font-bold">{Number(exp.amount).toLocaleString()} ₽</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

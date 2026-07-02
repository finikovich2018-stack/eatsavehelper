import TopBar from '@/components/layout/TopBar';
import {
  DEMO_RECEIPTS,
  DEMO_STATS,
  DEMO_USER,
} from '@/lib/marketing-demo-data';

const ACHIEVEMENTS = [
  { icon: '🧾', title: 'Первый чек', unlocked: true },
  { icon: '💰', title: 'Без перерасхода', unlocked: true },
  { icon: '👨‍🍳', title: 'Шеф-повар', unlocked: false },
  { icon: '🌱', title: 'Zero waste', unlocked: true },
];

export default function MarketingProfilePage() {
  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="Профиль" />
      <div className="max-w-mobile mx-auto px-4 py-4 space-y-6">
        <div className="bg-gradient-to-br from-surface/80 to-background border border-accent/20 rounded-3xl p-8 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full -mr-24 -mt-24 pointer-events-none" />
          <div className="flex flex-col items-center text-center relative">
            <div className="w-[104px] h-[104px] rounded-full bg-gradient-to-br from-accent/40 via-accent/20 to-accent/5 border-2 border-accent/50 flex items-center justify-center mb-5 shadow-[0_0_28px_rgba(126,217,87,0.2)]">
              <span className="text-[2rem] font-bold text-accent leading-none">
                {DEMO_USER.firstName.slice(0, 2)}
              </span>
            </div>
            <h1 className="text-2xl font-bold">{DEMO_USER.firstName}</h1>
            <p className="text-accent font-medium mt-1">@{DEMO_USER.username}</p>
            <div className="bg-accent/20 rounded-2xl px-5 py-3 border border-accent/50 text-center mt-4">
              <span className="text-accent font-bold text-sm block">⭐ Premium</span>
              <span className="text-xs text-muted">активен до {new Date(Date.now() + 86400000 * 25).toLocaleDateString('ru-RU')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">❄️</div>
            <div className="text-3xl font-bold text-accent mb-1">{DEMO_STATS.fridgeCount}</div>
            <div className="text-xs text-muted">Продуктов</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-3xl font-bold text-accent mb-1">8 720 ₽</div>
            <div className="text-xs text-muted">Потрачено</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">🧾</div>
            <div className="text-3xl font-bold text-accent mb-1">{DEMO_STATS.receiptCount}</div>
            <div className="text-xs text-muted">Чеков</div>
          </div>
          <div className="bg-surface border border-border rounded-2xl p-5 text-center">
            <div className="text-3xl mb-2">🍳</div>
            <div className="text-3xl font-bold text-accent mb-1">{DEMO_STATS.aiRecipeCount}</div>
            <div className="text-xs text-muted">AI-рецептов</div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-foreground text-lg mb-3">🏆 Достижения</h3>
          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.title}
                className={`rounded-2xl p-4 border text-center ${
                  a.unlocked ? 'bg-accent/10 border-accent/40' : 'bg-surface border-border opacity-50'
                }`}
              >
                <div className="text-3xl mb-2">{a.icon}</div>
                <div className="text-sm font-medium">{a.title}</div>
                {a.unlocked && <span className="inline-block mt-2 text-xs text-accent font-medium">Получено ✓</span>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-foreground text-lg">🧾 Чеки за 7 дней</h3>
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-3 mt-3">
            {DEMO_RECEIPTS.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.store_name}</div>
                  <div className="text-xs text-muted">
                    {new Date(r.scanned_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div className="text-sm font-semibold text-accent shrink-0">
                  {Number(r.total_amount).toLocaleString()} ₽
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface/60 border border-accent/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-accent font-semibold">🔔 Уведомления</span>
            <div className="w-14 h-8 rounded-full bg-accent relative">
              <div className="absolute right-1 top-1 w-6 h-6 bg-background rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

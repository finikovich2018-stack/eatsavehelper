import TopBar from '@/components/layout/TopBar';
import {
  DEMO_AI_RECIPES,
  DEMO_FRIDGE,
  DEMO_SAVED_RECIPE,
  daysLeft,
} from '@/lib/marketing-demo-data';

const POPULAR = [
  { icon: '🍳', name: 'Омлет с сыром', time: '15 мин', ingredients: ['Яйца', 'Молоко', 'Сыр'] },
  { icon: '🍲', name: 'Борщ украинский', time: '45 мин', ingredients: ['Свёкла', 'Капуста', 'Говядина'] },
  { icon: '🥗', name: 'Овощной салат', time: '10 мин', ingredients: ['Помидоры', 'Огурцы', 'Масло'] },
];

export default function MarketingRecipesPage() {
  const expiring = DEMO_FRIDGE.filter((item) => {
    const d = daysLeft(item.expiry_date);
    return d <= 3 && d > 0;
  }).slice(0, 4);

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="Рецепты" />
      <div className="max-w-mobile mx-auto px-4 py-6 space-y-6">
        <div className="w-full bg-gradient-to-r from-accent/30 to-accent/10 border border-accent rounded-2xl p-5 text-left">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">🤖 Что приготовить?</h3>
              <p className="text-sm text-muted">⭐ Premium — безлимитно</p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4">✨ AI-рецепты для вас</h3>
          <div className="space-y-3">
            {DEMO_AI_RECIPES.map((r) => (
              <div key={r.name} className="bg-surface border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-3xl">{r.icon}</span>
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-accent">⏱ {r.time}</div>
                  </div>
                </div>
                <p className="text-sm text-muted mb-2">{r.steps}</p>
                <div className="flex flex-wrap gap-1">
                  {r.usesFromFridge.map((ing) => (
                    <span key={ing} className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4">💾 Сохранённые</h3>
          <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
            <span className="text-4xl">{DEMO_SAVED_RECIPE.icon}</span>
            <div className="flex-1">
              <div className="font-semibold">{DEMO_SAVED_RECIPE.name}</div>
              <div className="text-xs text-muted mt-1">
                {DEMO_SAVED_RECIPE.ingredients.slice(0, 3).join(', ')}
              </div>
            </div>
            <span className="text-muted">›</span>
          </div>
        </div>

        {expiring.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-5">
            <h3 className="font-semibold mb-4">⚠️ Скоро испортится — готовь!</h3>
            <div className="space-y-2">
              {expiring.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted">{item.quantity}</div>
                  </div>
                  <span className="text-xs font-semibold text-yellow-400">
                    {daysLeft(item.expiry_date)} дн.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-4">🔥 Популярные</h3>
          <div className="space-y-3">
            {POPULAR.map((recipe) => (
              <div key={recipe.name} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-4">
                <span className="text-5xl">{recipe.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{recipe.name}</div>
                  <div className="text-xs text-muted mt-1">{recipe.ingredients.join(', ')}</div>
                  <div className="text-xs text-accent mt-2">⏱ {recipe.time}</div>
                </div>
                <span className="text-muted">›</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

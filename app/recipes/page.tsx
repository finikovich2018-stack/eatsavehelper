'use client';
import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';

const MOCK_RECIPES = [
  {
    id: '1',
    name: 'Куриный суп',
    icon: '🍲',
    kcal: 320,
    time: '40 мин',
    ingredients: ['Куриное филе', 'Морковь', 'Лук', 'Картофель'],
    steps: ['Сварить бульон', 'Добавить овощи', 'Варить 20 минут', 'Посолить по вкусу'],
  },
  {
    id: '2',
    name: 'Омлет с помидорами',
    icon: '🍳',
    kcal: 210,
    time: '15 мин',
    ingredients: ['Яйца', 'Помидоры', 'Молоко', 'Соль'],
    steps: ['Взбить яйца с молоком', 'Нарезать помидоры', 'Жарить на сковороде 10 минут'],
  },
  {
    id: '3',
    name: 'Греческий салат',
    icon: '🥗',
    kcal: 180,
    time: '10 мин',
    ingredients: ['Помидоры', 'Огурцы', 'Сыр фета', 'Оливки', 'Оливковое масло'],
    steps: ['Нарезать овощи', 'Добавить сыр и оливки', 'Заправить маслом'],
  },
];

export default function RecipesPage() {
  const [selected, setSelected] = useState<typeof MOCK_RECIPES[0] | null>(null);

  if (selected) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white pb-24">
        <TopBar title={selected.name} />
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="text-center py-6">
            <div className="text-6xl mb-2">{selected.icon}</div>
            <div className="flex justify-center gap-4 text-sm text-zinc-400">
              <span>🔥 {selected.kcal} ккал</span>
              <span>⏱ {selected.time}</span>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 mb-4">
            <h2 className="font-bold text-emerald-400 mb-3">Ингредиенты</h2>
            <ul className="space-y-2">
              {selected.ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-500">•</span> {ing}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 mb-4">
            <h2 className="font-bold text-emerald-400 mb-3">Приготовление</h2>
            <ol className="space-y-3">
              {selected.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <button onClick={() => setSelected(null)}
            className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium">
            ← Назад
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="👨‍🍳 Рецепты" />
      <div className="max-w-xl mx-auto px-4 py-4">

        <div className="bg-gradient-to-r from-emerald-900 to-zinc-900 rounded-2xl p-4 mb-6">
          <p className="text-sm text-zinc-300">💡 Рецепты подобраны на основе продуктов в вашем холодильнике</p>
        </div>

        <div className="space-y-3">
          {MOCK_RECIPES.map(recipe => (
            <button key={recipe.id} onClick={() => setSelected(recipe)}
              className="w-full bg-zinc-900 hover:bg-zinc-800 rounded-2xl p-4 flex items-center gap-4 text-left transition">
              <span className="text-4xl">{recipe.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{recipe.name}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {recipe.ingredients.slice(0, 3).join(', ')}
                </div>
                <div className="flex gap-3 mt-2 text-xs text-zinc-400">
                  <span>🔥 {recipe.kcal} ккал</span>
                  <span>⏱ {recipe.time}</span>
                </div>
              </div>
              <span className="text-zinc-600">›</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
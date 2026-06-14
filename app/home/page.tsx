'use client';

import { useState, useEffect, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { supabase } from '@/lib/supabase/client';
import { useTelegram } from '@/components/TelegramProvider';

// ... (оставь свои типы и функцию daysLeft без изменений)

export default function HomePage() {
  // ... (весь твой код до блока return)

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="EatSave" />
      <div className="max-w-md mx-auto px-4 py-6 space-y-8">
        
        {/* ... (Приветствие и Статистика - оставь как есть) */}

        {/* Быстрые действия */}
        <div>
          <h2 className="font-semibold mb-3 text-lg">Быстрые действия</h2>
          <div className="grid grid-cols-2 gap-3">
            <a href="/scan" className="bg-emerald-600 hover:bg-emerald-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
              <div className="text-3xl mb-1">📷</div>
              <div className="font-medium">Сканировать чек</div>
            </a>
            {/* Заменил Link на a для всех кнопок ниже */}
            <a href="/fridge" className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
              <div className="text-3xl mb-1">🥬</div>
              <div className="font-medium">Холодильник</div>
            </a>
            <a href="/recipes" className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
              <div className="text-3xl mb-1">👨‍🍳</div>
              <div className="font-medium">Рецепты</div>
            </a>
            <a href="/budget" className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
              <div className="text-3xl mb-1">💰</div>
              <div className="font-medium">Бюджет</div>
            </a>
          </div>
        </div>

        {/* Полезные советы */}
        <div>
          <h2 className="font-semibold mb-3 text-lg">💡 Полезные советы</h2>
          <div className="space-y-3">
            <a href="/fridge" className="block bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-3xl p-5 active:scale-[0.985] transition">
              <div className="flex items-start gap-4">
                <div className="text-3xl">🥶</div>
                <div>
                  <div className="font-semibold">Проверяйте холодильник каждый день</div>
                  <div className="text-sm text-zinc-400 mt-1">Чтобы не забыть про продукты.</div>
                </div>
              </div>
            </a>
            <a href="/recipes" className="block bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-3xl p-5 active:scale-[0.985] transition">
              <div className="flex items-start gap-4">
                <div className="text-3xl">📖</div>
                <div>
                  <div className="font-semibold">Используйте рецепты</div>
                  <div className="text-sm text-zinc-400 mt-1">Чтобы готовить из продуктов.</div>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

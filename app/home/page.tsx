'use client';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="max-w-md mx-auto px-4 py-6 text-white min-h-screen bg-zinc-950">
      <h2 className="text-xl font-bold mb-4">Быстрые действия</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/scan" className="bg-emerald-600 hover:bg-emerald-500 rounded-2xl p-5 text-center active:scale-[0.98] transition">
          <div className="text-3xl mb-1">📷</div>
          <div className="font-medium">Сканировать чек</div>
        </Link>
        <Link href="/fridge" className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
          <div className="text-3xl mb-1">❄️</div>
          <div className="font-medium">Холодильник</div>
        </Link>
        <Link href="/recipes" className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
          <div className="text-3xl mb-1">👨‍🍳</div>
          <div className="font-medium">Рецепты</div>
        </Link>
        <Link href="/budget" className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-5 text-center active:scale-[0.98] transition">
          <div className="text-3xl mb-1">💰</div>
          <div className="font-medium">Бюджет</div>
        </Link>
      </div>

      <h2 className="font-semibold mb-3 text-lg">💡 Полезные советы</h2>
      <div className="space-y-3">
        <Link href="/fridge" className="block bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-3xl p-5 active:scale-[0.985] transition">
          <div className="flex items-start gap-4">
            <div className="text-3xl">🧊</div>
            <div>
              <div className="font-semibold">Проверяйте холодильник каждый день</div>
              <div className="text-sm text-zinc-400 mt-1">Чтобы не забыть про продукты.</div>
            </div>
          </div>
        </Link>
        <Link href="/recipes" className="block bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-3xl p-5 active:scale-[0.985] transition">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📖</div>
            <div>
              <div className="font-semibold">Используйте рецепты</div>
              <div className="text-sm text-zinc-400 mt-1">Чтобы готовить из продуктов.</div>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}



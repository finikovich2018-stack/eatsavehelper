'use client';
import { useState } from 'react';
import TopBar from '@/components/layout/TopBar';

type ScannedItem = {
  name: string;
  category: string;
  price: number;
  expiry_days: number;
  icon: string;
};

export default function ScanPage() {
  const [step, setStep] = useState<'idle' | 'scanning' | 'result'>('idle');
  const [items, setItems] = useState<ScannedItem[]>([]);

  const mockScan = () => {
    setStep('scanning');
    setTimeout(() => {
      setItems([
        { name: 'Молоко 3.2%', category: 'dairy', price: 89, expiry_days: 7, icon: '🥛' },
        { name: 'Творог 5%', category: 'dairy', price: 120, expiry_days: 5, icon: '🧀' },
        { name: 'Хлеб белый', category: 'grains', price: 45, expiry_days: 3, icon: '🍞' },
        { name: 'Куриная грудка', category: 'meat', price: 380, expiry_days: 4, icon: '🍗' },
      ]);
      setStep('result');
    }, 2000);
  };

  const total = items.reduce((s, i) => s + i.price, 0);

  if (step === 'scanning') {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <TopBar title="📷 Сканер чека" />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <div className="text-6xl animate-bounce">📷</div>
          <div className="text-zinc-400">Распознаю чек...</div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (step === 'result') {
    return (
      <main className="min-h-screen bg-zinc-950 text-white pb-24">
        <TopBar title="📷 Результат сканирования" />
        <div className="max-w-xl mx-auto px-4 py-4">

          <div className="bg-emerald-900/50 border border-emerald-700 rounded-2xl p-4 mb-4">
            <div className="text-sm text-emerald-400 font-medium">✅ Чек распознан успешно</div>
            <div className="text-xs text-zinc-400 mt-1">Найдено {items.length} продукта на сумму {total} ₽</div>
          </div>

          <div className="space-y-3 mb-4">
            {items.map((item, i) => (
              <div key={i} className="bg-zinc-900 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-3xl">{item.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Срок: ~{item.expiry_days} дн.
                  </div>
                </div>
                <div className="font-bold">{item.price} ₽</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('idle')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-2xl font-medium mb-3">
            ✅ Добавить всё в холодильник
          </button>
          <button
            onClick={() => { setStep('idle'); setItems([]); }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium">
            Отмена
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white pb-24">
      <TopBar title="📷 Сканер чека" />
      <div className="max-w-xl mx-auto px-4 py-4">

        <div className="bg-zinc-900 rounded-2xl p-8 text-center mb-6">
          <div className="text-7xl mb-4">📷</div>
          <h2 className="text-xl font-bold mb-2">Сфотографируй чек</h2>
          <p className="text-zinc-500 text-sm">
            ИИ автоматически распознает продукты и добавит их в холодильник
          </p>
        </div>

        <button onClick={mockScan}
          className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-bold text-lg mb-3">
          📷 Сканировать чек
        </button>

        <div className="bg-zinc-900 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Как это работает</h3>
          <div className="space-y-2">
            {[
              ['📷', 'Фотографируешь чек из магазина'],
              ['🤖', 'ИИ распознаёт все продукты'],
              ['🥬', 'Продукты добавляются в холодильник'],
              ['💰', 'Сумма записывается в бюджет'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{icon}</span>
                <span className="text-zinc-400">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
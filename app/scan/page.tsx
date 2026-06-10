'use client';

import { useState, useRef } from "react";
import { useTelegram } from '@/components/TelegramProvider';

export default function ScanPage() {
  const { user } = useTelegram();
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    setItems([]);
  };

  const parseReceipt = async () => {
    if (!image) {
      alert("Сначала выберите фото чека!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error(error);
      alert("Ошибка при распознавании. Попробуйте другое фото.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-6 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">📷 Сканер чека</h1>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="space-y-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full bg-emerald-600 hover:bg-emerald-700 py-5 rounded-3xl text-lg font-medium flex items-center justify-center gap-3"
        >
          📸 Сфотографировать чек
        </button>

        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = handleFile;
            input.click();
          }}
          className="w-full bg-zinc-700 hover:bg-zinc-600 py-5 rounded-3xl text-lg font-medium flex items-center justify-center gap-3"
        >
          🖼 Выбрать из галереи
        </button>
      </div>

      {image && (
        <div className="mt-6">
          <img src={image} className="w-full rounded-2xl mb-4" alt="чек" />
          <button
            onClick={parseReceipt}
            disabled={loading}
            className="w-full bg-emerald-600 py-4 rounded-3xl font-medium text-lg disabled:bg-zinc-700"
          >
            {loading ? "🤖 Распознаю..." : "🔍 Распознать чек"}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 bg-zinc-900 rounded-3xl p-5">
          <h2 className="font-semibold mb-4">Найдено товаров: {items.length}</h2>
          {items.map((item, i) => (
            <div key={i} className="py-2 border-b border-zinc-700 last:border-0">
              {item.name} — {item.price} ₽
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
'use client';

import { useState } from "react";
import { useTelegram } from '@/components/TelegramProvider';

export default function ScanPage() {
  const { user } = useTelegram();
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    setItems([]);
  };

  const openCamera = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const openGallery = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  const parseReceipt = async () => {
    if (!image) return;
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
      alert("Ошибка при распознавании.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-6 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">📷 Сканер чека</h1>

      <div className="space-y-4">
        <button onClick={openGallery}
          className="w-full bg-zinc-700 hover:bg-zinc-600 py-5 rounded-3xl text-lg font-medium">
          🖼 Выбрать из галереи
        </button>
      </div>

      {image && (
        <div className="mt-6">
          <img src={image} className="w-full rounded-2xl mb-4" alt="чек" />
          <button onClick={parseReceipt} disabled={loading}
            className="w-full bg-emerald-600 py-4 rounded-3xl font-medium text-lg disabled:bg-zinc-700">
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
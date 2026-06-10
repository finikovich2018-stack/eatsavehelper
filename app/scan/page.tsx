"use client";
import { useState, useRef } from "react";
import { useTelegram } from "../../components/TelegramProvider";
import { supabase } from "../../lib/supabase/client";

export default function ScanPage() {
  const { user } = useTelegram();
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, type?: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    setItems([]);
    setSuccess(false);
  }

  async function parseReceipt() {
    if (!image) return;
    setLoading(true);
    try {
      const base64 = image.split(",")[1];
      const res = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType })
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      alert("Ошибка распознавания");
    }
    setLoading(false);
  }

  async function addToFridge() {
    if (!user?.id || !items.length) return;
    const today = new Date();
    const rows = items.map(item => {
      const expiry = new Date(today);
      expiry.setDate(expiry.getDate() + (item.expiry_days || 7));
      return {
        name: item.name,
        category: item.category || "other",
        quantity: "1",
        expiry_date: expiry.toISOString().split("T")[0],
        icon: item.icon || "??",
        telegram_user_id: user.id,
        added_from: "receipt"
      };
    });
    await supabase.from("fridge_items").insert(rows);
    setSuccess(true);
    setItems([]);
    setImage(null);
  }

  return (
    <main className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-4">?? Сканер чека</h1>
      <div className="flex gap-3 mb-4">
        <button onClick={() => cameraRef.current?.click()}
          className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium">
          ?? Камера
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex-1 bg-zinc-700 text-white py-3 rounded-xl font-medium">
          ?? Галерея
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {image && (
        <div className="mb-4">
          <img src={image} alt="Чек" className="w-full rounded-xl mb-3" />
          <button onClick={parseReceipt} disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium disabled:opacity-50">
            {loading ? "Распознаю..." : "?? Распознать чек"}
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl p-4 mb-4">
          <h2 className="font-semibold mb-3">Найдено продуктов:</h2>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-zinc-800 last:border-0">
              <span>{item.icon} {item.name}</span>
              <span className="text-zinc-400">{item.price}?</span>
            </div>
          ))}
          <button onClick={addToFridge}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium mt-3">
            ? Добавить в холодильник
          </button>
        </div>
      )}
      {success && <div className="bg-emerald-900 text-emerald-300 p-4 rounded-xl text-center">? Продукты добавлены!</div>}
    </main>
  );
}

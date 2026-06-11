'use client';

import { useState } from "react";
import { useTelegram } from '@/components/TelegramProvider';
import { supabase } from '@/lib/supabase/client';

export default function ScanPage() {
  const { user } = useTelegram();
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const openGallery = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
      setItems([]);
      setSaved(false);
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
    } catch {
      alert("Ошибка при распознавании.");
    } finally {
      setLoading(false);
    }
  };

  const addToFridge = async () => {
    if (!user?.id || items.length === 0) return;
    setSaving(true);
    try {
      const rows = items.map(item => {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (item.expiry_days || 7));
        return {
          name: item.name,
          category: item.category || 'other',
          quantity: `${item.quantity || 1} шт.`,
          expiry_date: expiryDate.toISOString().split('T')[0],
          icon: item.icon || '📦',
          telegram_user_id: user.id,
        };
      });
      const { error } = await supabase.from('fridge_items').insert(rows);
      if (error) throw error;
      setSaved(true);
      setItems([]);
      setImage(null);
    } catch {
      alert("Ошибка при сохранении.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 py-6 bg-zinc-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">📷 Сканер чека</h1>

      <button onClick={openGallery}
        className="w-full bg-zinc-700 hover:bg-zinc-600 py-5 rounded-3xl text-lg font-medium">
        🖼 Выбрать из галереи
      </button>

      {saved && (
        <div className="mt-6 bg-emerald-900 rounded-2xl p-4 text-center
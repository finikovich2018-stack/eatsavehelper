import TopBar from '@/components/layout/TopBar';
import {
  DEMO_SCAN_CURRENCY,
  DEMO_SCAN_ITEMS,
  DEMO_SCAN_STORE,
  DEMO_SCAN_TOTAL,
} from '@/lib/marketing-demo-data';

function ReceiptMockup() {
  return (
    <div className="w-full rounded-2xl mb-4 border border-border overflow-hidden bg-[#f5f5f0] text-[#1a1a1a] shadow-lg">
      <div className="px-4 py-3 border-b border-dashed border-gray-300 text-center">
        <div className="font-bold text-lg tracking-wide text-[#e30613]">ПЯТЁРОЧКА</div>
        <div className="text-[10px] text-gray-500 mt-1">г. Москва · ул. Ленина 12</div>
        <div className="text-[10px] text-gray-500">{new Date().toLocaleString('ru-RU')}</div>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm font-mono">
        {DEMO_SCAN_ITEMS.map((item) => (
          <div key={item.name} className="flex justify-between gap-2">
            <span className="truncate">{item.name}</span>
            <span className="shrink-0">{item.price.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-gray-400 pt-2 flex justify-between font-bold text-base">
          <span>ИТОГО</span>
          <span>{DEMO_SCAN_TOTAL.toFixed(2)} ₽</span>
        </div>
        <div className="text-[10px] text-gray-500 text-center pt-1">СПАСИБО ЗА ПОКУПКУ!</div>
      </div>
    </div>
  );
}

export default function MarketingScanPage() {
  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
      <TopBar title="Сканер чека" />
      <div className="max-w-mobile mx-auto px-4 py-4">
        <div className="mb-4 text-sm text-muted">
          <span className="text-accent">✨ Premium — безлимитные сканы</span>
        </div>

        <ReceiptMockup />

        <div className="bg-surface border border-border rounded-3xl p-5">
          <h2 className="font-semibold mb-4">
            Найдено {DEMO_SCAN_ITEMS.length} позиций{' '}
            <span className="text-accent">{DEMO_SCAN_CURRENCY}</span>
          </h2>
          <p className="text-xs text-muted mb-4">Проверьте названия и сроки годности перед сохранением</p>
          <div className="space-y-3 mb-4">
            {DEMO_SCAN_ITEMS.map((item) => (
              <div key={item.name} className="bg-background border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm">
                    {item.name}
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <div className="w-1/2 bg-surface border border-border rounded-lg px-3 py-2">
                    {item.price.toFixed(2)} ₽
                  </div>
                  <div className="w-1/2 bg-surface border border-border rounded-lg px-3 py-2">
                    {item.expiry_days} дн.
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="w-full bg-accent text-background py-4 rounded-2xl font-medium text-lg">
            ✅ Добавить всё в холодильник
          </button>
        </div>

        <div className="mt-4 bg-accent/10 border border-accent/30 rounded-2xl p-4 text-center text-accent font-medium">
          🧾 {DEMO_SCAN_STORE} · {DEMO_SCAN_TOTAL.toFixed(2)} ₽ — сохранено в бюджет
        </div>
      </div>
    </main>
  );
}

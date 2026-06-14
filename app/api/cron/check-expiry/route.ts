import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const in3days = new Date(today);
  in3days.setDate(today.getDate() + 3);

  const dateStr = in3days.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const { data: items } = await supabase
    .from('fridge_items')
    .select('*, telegram_user_id')
    .gte('expiry_date', todayStr)
    .lte('expiry_date', dateStr);

  if (!items || items.length === 0) {
    return NextResponse.json({ message: 'No expiring items' });
  }

  // Группируем по пользователю
  const byUser: Record<number, typeof items> = {};
  for (const item of items) {
    if (!byUser[item.telegram_user_id]) byUser[item.telegram_user_id] = [];
    byUser[item.telegram_user_id].push(item);
  }

  for (const [userId, userItems] of Object.entries(byUser)) {
    const lines = userItems.map(item => {
      const days = Math.ceil((new Date(item.expiry_date).getTime() - today.getTime()) / 86400000);
      const emoji = days <= 1 ? '🔴' : days <= 2 ? '🟡' : '🟢';
      return `${emoji} <b>${item.name}</b> — истекает через ${days} дн.`;
    }).join('\n');

    const text = `⏰ <b>EatSave — напоминание о продуктах</b>\n\nСкоро истекает срок годности:\n\n${lines}\n\n🧊 Откройте холодильник и проверьте продукты!`;

    await sendMessage(Number(userId), text);
  }

  return NextResponse.json({ message: `Notified ${Object.keys(byUser).length} users` });
}
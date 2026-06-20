import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppHomeUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type ExpiringRow = {
  user_telegram_id: number;
  first_name: string | null;
  item_name: string;
  expiry_date: string;
  days_left: number;
  chat_id: number;
};

async function sendMessage(chatId: number, text: string) {
  const botToken = getBotToken();
  if (!botToken) return false;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '📦 Открыть EatSave', web_app: { url: getAppHomeUrl() } },
        ]],
      },
    }),
  });

  return res.ok;
}

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getBotToken()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = tomorrow.toISOString().split('T')[0];

  const { data: rows, error } = await supabase.rpc('get_expiring_items', {
    target_date: targetDate,
  });

  if (error) {
    console.error('get_expiring_items error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (rows || []) as ExpiringRow[];

  const dryRun = new URL(req.url).searchParams.get('dry_run') === '1';

  if (items.length === 0) {
    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      message: 'No expiring items tomorrow',
      target_date: targetDate,
      users_notified: 0,
      preview: [],
    });
  }

  const byUser: Record<number, { name: string; items: ExpiringRow[] }> = {};

  for (const row of items) {
    if (!row.chat_id) continue;
    if (!byUser[row.user_telegram_id]) {
      byUser[row.user_telegram_id] = { name: row.first_name || 'друг', items: [] };
    }
    byUser[row.user_telegram_id].items.push(row);
  }

  const preview = Object.entries(byUser).map(([userId, user]) => ({
    telegram_user_id: Number(userId),
    chat_id: user.items[0].chat_id,
    items: user.items.map((i) => i.item_name),
  }));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      target_date: targetDate,
      would_notify: preview.length,
      items_found: items.length,
      preview,
    });
  }

  let sent = 0;
  for (const [, user] of Object.entries(byUser)) {
    const chatId = user.items[0].chat_id;
    const lines = user.items
      .map((i) => `• <b>${i.item_name}</b>`)
      .join('\n');

    const text =
      `⏰ <b>EatSave — напоминание</b>\n\n` +
      `Привет, ${user.name}! Завтра истекает срок годности:\n\n` +
      `${lines}\n\n` +
      `Используйте продукты сегодня 🍽️`;

    const ok = await sendMessage(chatId, text);
    if (ok) sent++;
  }

  return NextResponse.json({
    ok: true,
    target_date: targetDate,
    users_notified: sent,
    items_found: items.length,
  });
}

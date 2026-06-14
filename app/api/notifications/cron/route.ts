// GET /api/notifications/cron
// Vercel Cron job — runs daily at 9:00 UTC
// Sends Telegram push to users who have products expiring tomorrow
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TELEGRAM_API = 'https://api.telegram.org/bot';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// Vercel Cron configuration — runs every day at 09:00 UTC
export async function GET(req: NextRequest) {
  // Security: verify the cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.TELEGRAM_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDate = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    // Query Supabase directly via REST
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Get items expiring tomorrow
    const expiringRes = await fetch(
      `${supabaseUrl}/rest/v1/fridge_items?expiry_date=eq.${targetDate}&select=*,users(telegram_user_id,telegram_chat_id,first_name,notifications_enabled)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'inner=users',
        },
      }
    );

    if (!expiringRes.ok) {
      console.error('Supabase query failed:', await expiringRes.text());
      return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
    }

    const items: any[] = await expiringRes.json();

    // Group by user
    const byUser = new Map<number, { name: string; first_name: string; chat_id: number }[]>();
    for (const item of items) {
      const user = item.users;
      if (!user?.notifications_enabled || !user?.telegram_chat_id) continue;
      if (!byUser.has(user.telegram_user_id)) {
        byUser.set(user.telegram_user_id, []);
      }
      byUser.get(user.telegram_user_id)!.push({
        name: item.name,
        first_name: user.first_name || 'друг',
        chat_id: user.telegram_chat_id,
      });
    }

    // Send Telegram messages
    let sent = 0;
    for (const [, userItems] of byUser) {
      const first = userItems[0];
      const itemList = userItems.map(i => `• ${i.name}`).join('\n');
      const text =
        `⏰ *Напоминание от EatSave*\n\n` +
        `Привет, ${first.first_name}! Завтра истекает срок годности у:\n\n` +
        `${itemList}\n\n` +
        `Используй их сегодня, чтобы не выбрасывать! 🍽️`;

      await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: first.chat_id,
          text,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📦 Открыть холодильник', url: 'https://eatsavehelper-m6hl.vercel.app/fridge' },
            ]],
          },
        }),
      });
      sent++;
    }

    return NextResponse.json({ ok: true, users_notified: sent, items_found: items.length });
  } catch (e) {
    console.error('Notification cron error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/bot
// Telegram Bot webhook — receives updates and captures chat_id for notifications
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface TelegramUpdate {
  message?: {
    from: { id: number; first_name?: string; username?: string };
    text?: string;
  };
  pre_checkout_query?: { from: { id: number }; id: string };
  successful_payment?: {
    from: { id: number };
    telegram_payment_charge_id: string;
  };
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN!;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const BOT_TOKEN = getBotToken();

  try {
    const body = await req.json() as TelegramUpdate;

    // 1. Capture /start and /subscribe — save user's chat_id
    if (body.message?.text?.startsWith('/start')) {
      const from = body.message.from;
      const chatId = from.id;
      const firstName = from.first_name || '';
      const username = from.username;

      await supabase.from('users').upsert(
        {
          telegram_user_id: chatId,
          telegram_chat_id: chatId,
          first_name: firstName,
          username: username,
          notifications_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_user_id' }
      );

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Привет, ${firstName}! 👋\n\nЯ EatSave бот. Откройте приложение, чтобы начать отслеживать продукты и получать напоминания о сроках годности.`,
          reply_markup: {
            inline_keyboard: [[
              { text: '📱 Открыть EatSave', url: 'https://eatsavehelper-m6hl.vercel.app/home' },
            ]],
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // 2. Handle /subscribe — re-enable notifications
    if (body.message?.text === '/subscribe') {
      const chatId = body.message.from.id;
      await supabase
        .from('users')
        .update({ notifications_enabled: true, telegram_chat_id: chatId, updated_at: new Date().toISOString() })
        .eq('telegram_user_id', chatId);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Уведомления включены! Буду напоминать вам о продуктах с истекающим сроком годности.',
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Handle /unsubscribe
    if (body.message?.text === '/unsubscribe') {
      const chatId = body.message.from.id;
      await supabase
        .from('users')
        .update({ notifications_enabled: false, updated_at: new Date().toISOString() })
        .eq('telegram_user_id', chatId);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🔕 Уведомления выключены. Напишите /subscribe чтобы включить обратно.',
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Handle /status
    if (body.message?.text === '/status') {
      const chatId = body.message.from.id;
      const { data } = await supabase
        .from('users')
        .select('is_premium, notifications_enabled')
        .eq('telegram_user_id', chatId)
        .single();

      const premium = data?.is_premium ? '✅ Premium' : '❌ Free';
      const notifs = data?.notifications_enabled ? '✅' : '❌';

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📊 *Ваш статус*\n\nПодписка: ${premium}\nУведомления: ${notifs}`,
          parse_mode: 'Markdown',
        }),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Bot webhook error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { activatePremium } from '@/lib/premium';
import { getAppHomeUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

type TelegramUpdate = {
  message?: {
    from: { id: number; first_name?: string; username?: string };
    text?: string;
    successful_payment?: {
      invoice_payload: string;
      currency: string;
      total_amount: number;
    };
  };
  pre_checkout_query?: {
    id: string;
    invoice_payload: string;
  };
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function checkWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get('x-telegram-bot-api-secret-token') === secret;
}

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  const botToken = getBotToken();
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
}

async function answerPreCheckout(queryId: string, ok: boolean, errorMessage?: string) {
  const botToken = getBotToken();
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pre_checkout_query_id: queryId,
      ok,
      error_message: errorMessage,
    }),
  });
}

function parsePremiumUserId(payload: string): number | null {
  if (!payload.startsWith('premium_')) return null;
  const id = Number(payload.replace('premium_', ''));
  return Number.isFinite(id) ? id : null;
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'EatSave bot webhook is live' });
}

export async function POST(req: NextRequest) {
  if (!checkWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const BOT_TOKEN = getBotToken();

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const body = (await req.json()) as TelegramUpdate;

    if (body.pre_checkout_query) {
      const { id, invoice_payload } = body.pre_checkout_query;
      const userId = parsePremiumUserId(invoice_payload);

      if (!userId) {
        await answerPreCheckout(id, false, 'Некорректный платёж');
        return NextResponse.json({ ok: true });
      }

      await answerPreCheckout(id, true);
      return NextResponse.json({ ok: true });
    }

    const payment = body.message?.successful_payment;
    if (payment) {
      const userId =
        parsePremiumUserId(payment.invoice_payload) ?? body.message?.from?.id ?? null;

      if (userId && payment.currency === 'XTR') {
        try {
          await activatePremium(userId);
          await sendMessage(
            userId,
            '⭐ Premium активирован на 30 дней! Спасибо за поддержку EatSave.'
          );
        } catch (e) {
          console.error('activatePremium failed:', e);
          await sendMessage(
            userId,
            '⚠️ Оплата получена, но активация Premium не удалась. Напишите /activate или откройте Профиль → «Активировать Premium».'
          );
        }
      } else {
        console.error('Premium payment ignored:', payment);
      }
      return NextResponse.json({ ok: true });
    }

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
          username: username || null,
          notifications_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_user_id' }
      );

      await sendMessage(
        chatId,
        `Привет, ${firstName}! 👋\n\nЯ EatSave бот. Откройте приложение, чтобы отслеживать продукты и получать напоминания о сроках годности.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: '📱 Открыть EatSave', web_app: { url: getAppHomeUrl() } }]],
          },
        }
      );

      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/subscribe') {
      const chatId = body.message.from.id;
      await supabase
        .from('users')
        .update({ notifications_enabled: true, telegram_chat_id: chatId, updated_at: new Date().toISOString() })
        .eq('telegram_user_id', chatId);

      await sendMessage(chatId, '✅ Уведомления включены!');
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/unsubscribe') {
      const chatId = body.message.from.id;
      await supabase
        .from('users')
        .update({ notifications_enabled: false, updated_at: new Date().toISOString() })
        .eq('telegram_user_id', chatId);

      await sendMessage(chatId, '🔕 Уведомления выключены. Напишите /subscribe чтобы включить обратно.');
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/activate') {
      const chatId = body.message.from.id;
      try {
        await activatePremium(chatId);
        await sendMessage(chatId, '⭐ Premium активирован на 30 дней!');
      } catch (e) {
        console.error('Manual activate failed:', e);
        await sendMessage(chatId, '⚠️ Не удалось активировать Premium. Откройте Mini App → Профиль.');
      }
      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === '/status') {
      const chatId = body.message.from.id;
      const { data } = await supabase
        .from('users')
        .select('is_premium, notifications_enabled')
        .eq('telegram_user_id', chatId)
        .single();

      const premium = data?.is_premium ? '✅ Premium' : '❌ Free';
      const notifs = data?.notifications_enabled ? '✅' : '❌';

      await sendMessage(chatId, `📊 Ваш статус\n\nПодписка: ${premium}\nУведомления: ${notifs}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Bot webhook error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

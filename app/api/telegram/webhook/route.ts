import { NextRequest, NextResponse } from 'next/server';
import { activatePremium } from '@/lib/premium';

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
}

type TelegramUpdate = {
  pre_checkout_query?: {
    id: string;
    invoice_payload: string;
  };
  message?: {
    successful_payment?: {
      invoice_payload: string;
      currency: string;
      total_amount: number;
    };
  };
};

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

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const update: TelegramUpdate = await req.json();

    if (update.pre_checkout_query) {
      const { id, invoice_payload } = update.pre_checkout_query;
      const userId = parsePremiumUserId(invoice_payload);

      if (!userId) {
        await answerPreCheckout(id, false, 'Некорректный платёж');
        return NextResponse.json({ ok: true });
      }

      await answerPreCheckout(id, true);
      return NextResponse.json({ ok: true });
    }

    const payment = update.message?.successful_payment;
    if (payment) {
      const userId = parsePremiumUserId(payment.invoice_payload);

      if (!userId) {
        return NextResponse.json({ ok: true });
      }

      if (payment.currency !== 'XTR') {
        return NextResponse.json({ ok: true });
      }

      await activatePremium(userId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

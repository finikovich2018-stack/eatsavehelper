import { NextRequest, NextResponse } from 'next/server';
import { PREMIUM_PRICE_STARS, PREMIUM_SUBSCRIPTION_PERIOD } from '@/lib/constants';

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Не указан userId' }, { status: 400 });
    }

    const botToken = getBotToken();
    if (!botToken) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN не настроен' }, { status: 500 });
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'EatSave Premium',
        description: 'Месячная подписка Premium — безлимитные сканы и AI-рецепты',
        payload: `premium_${userId}`,
        provider_token: '',
        currency: 'XTR',
        subscription_period: PREMIUM_SUBSCRIPTION_PERIOD,
        prices: [{ label: 'Premium (1 месяц)', amount: PREMIUM_PRICE_STARS }],
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description || 'Ошибка Telegram API' }, { status: 400 });
    }

    return NextResponse.json({ invoiceLink: data.result });
  } catch {
    return NextResponse.json({ error: 'Ошибка создания счёта' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

import { PREMIUM_PRICE_STARS } from '@/lib/constants';

import { getBotToken } from '@/lib/bot-token';

import { verifyApiUser } from '@/lib/verify-api-user';



export const dynamic = 'force-dynamic';



export async function POST(req: NextRequest) {

  try {

    const body = await req.json();

    const auth = verifyApiUser(body);

    if (!auth.ok) {

      return NextResponse.json({ error: auth.error }, { status: auth.status });

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

        payload: `premium_${auth.userId}`,

        provider_token: '',

        currency: 'XTR',

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


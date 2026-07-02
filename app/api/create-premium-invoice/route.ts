import { NextRequest, NextResponse } from 'next/server';

import { createPremiumInvoiceLink } from '@/lib/premium-invoice';
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

    const result = await createPremiumInvoiceLink(botToken, auth.userId);

    if (!result.ok || !result.link) {
      return NextResponse.json({ error: result.description || 'Ошибка Telegram API' }, { status: 400 });
    }

    return NextResponse.json({ invoiceLink: result.link });
  } catch {
    return NextResponse.json({ error: 'Ошибка создания счёта' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
}

/** @deprecated Use POST /api/setup instead */
export async function POST(req: NextRequest) {
  try {
    const botToken = getBotToken();
    if (!botToken) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN не настроен' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const appUrl = body.appUrl || getAppBaseUrl();

    if (!appUrl) {
      return NextResponse.json(
        { error: 'Укажите NEXT_PUBLIC_APP_URL в .env.local (без /home)' },
        { status: 400 }
      );
    }

    const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/bot`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    const payload: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message', 'pre_checkout_query'],
    };

    if (secret) {
      payload.secret_token = secret;
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ ok: true, webhookUrl });
  } catch {
    return NextResponse.json({ error: 'Не удалось установить webhook' }, { status: 500 });
  }
}

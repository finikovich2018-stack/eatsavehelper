import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { callClaudeViaWorker } from '@/lib/ai';
import { getClaudeModel } from '@/lib/ai-model';
import { parseReceiptJson } from '@/lib/parse-receipt-json';
import { buildVisionMessage, parseImageDataUrl } from '@/lib/receipt-image';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  consumeScanSlot,
  getUserWithLimits,
  refundScanSlot,
  UsageLimitError,
} from '@/lib/usage-limits';
import { isPremiumActive } from '@/lib/user-utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Long receipts (15+ items) need a larger output budget. */
const RECEIPT_MAX_TOKENS = 4096;

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY не настроен на сервере');
  return new Anthropic({ apiKey });
}

const PARSE_PROMPT = `Извлеки ВСЕ продукты питания и напитки с чека. Игнорируй бытовую химию и упаковку.
Определи валюту (RUB, EUR, USD…). Верни ТОЛЬКО валидный JSON без markdown и комментариев.
Короткие названия (до 60 символов). Экранируй кавычки в названиях.

{
  "currency": "RUB",
  "items": [
    {"name": "Молоко", "quantity": 1, "price": 89.99, "expiry_days": 5, "category": "dairy", "icon": "🥛"}
  ]
}

category: dairy | meat | veg | grains | other
expiry_days — примерный срок годности в днях от покупки.`;

async function callClaudeForReceipt(
  message: ReturnType<typeof buildVisionMessage>,
  userId: number,
  isPremium: boolean
): Promise<string> {
  if (process.env.NEXT_PUBLIC_WORKER_URL) {
    return callClaudeViaWorker({
      userId,
      isPremium,
      messages: [message],
      maxTokens: RECEIPT_MAX_TOKENS,
    });
  }

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: getClaudeModel(),
    max_tokens: RECEIPT_MAX_TOKENS,
    messages: [message],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { image } = body;
    if (!image) {
      return NextResponse.json({ error: 'Нет изображения' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const scansThisMonth = await consumeScanSlot(supabase, auth.userId);

    try {
      const user = await getUserWithLimits(supabase, auth.userId);
      const isPremium = isPremiumActive(user || {});
      const { mediaType, base64Data } = parseImageDataUrl(image);
      const message = buildVisionMessage(base64Data, mediaType, PARSE_PROMPT);
      const text = await callClaudeForReceipt(message, auth.userId, isPremium);
      const parsed = parseReceiptJson(text);

      return NextResponse.json({
        items: parsed.items,
        currency: parsed.currency,
        scans_this_month: scansThisMonth,
      });
    } catch (innerError: unknown) {
      // The slot was already consumed above, but the scan didn't actually
      // produce a result — refund it so a transient AI/network failure
      // doesn't cost the user one of their limited free scans.
      await refundScanSlot(supabase, auth.userId);
      throw innerError;
    }
  } catch (error: unknown) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json(
        { error: 'Достигнут лимит бесплатных сканов', code: error.code },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PARSE RECEIPT ERROR:', message);
    return NextResponse.json({ error: 'Ошибка распознавания', details: message }, { status: 500 });
  }
}

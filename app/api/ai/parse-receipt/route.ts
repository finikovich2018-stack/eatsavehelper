import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { callClaudeViaWorker } from '@/lib/ai';
import { getClaudeModel } from '@/lib/ai-model';
import { buildVisionMessage, parseImageDataUrl } from '@/lib/receipt-image';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  assertCanScan,
  incrementScanCount,
  UsageLimitError,
} from '@/lib/usage-limits';
import { isPremiumActive } from '@/lib/user-utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY не настроен на сервере');
  return new Anthropic({ apiKey });
}

const PARSE_PROMPT = `Извлеки ТОЛЬКО продукты питания и напитки с чека. Игнорируй бытовые товары. Определи валюту чека (USD, EUR, RUB и т.д.). Верни ТОЛЬКО чистый JSON без markdown:

{
  "currency": "USD",
  "items": [
    {"name": "Название товара", "quantity": 1, "price": 1.49, "expiry_days": 7, "category": "veg", "icon": "🥦"}
  ]
}

category: dairy | meat | veg | grains | other`;

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON не найден в ответе AI');
  return JSON.parse(match[0]);
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
    const user = await assertCanScan(supabase, auth.userId);
    const scansThisMonth = isPremiumActive(user)
      ? user.scans_this_month || 0
      : await incrementScanCount(supabase, auth.userId, user);

    const { mediaType, base64Data } = parseImageDataUrl(image);
    const message = buildVisionMessage(base64Data, mediaType, PARSE_PROMPT);
    let text = '';

    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      text = await callClaudeViaWorker({
        userId: auth.userId,
        isPremium: isPremiumActive(user),
        messages: [message],
      });
    } else {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: getClaudeModel(),
        max_tokens: 1500,
        messages: [message],
      });

      text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }

    const parsed = extractJson(text);

    return NextResponse.json({
      items: parsed.items || [],
      currency: parsed.currency || 'RUB',
      scans_this_month: scansThisMonth,
    });
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

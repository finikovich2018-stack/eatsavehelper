import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { callClaudeViaWorker } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const PARSE_PROMPT = `Извлеки ТОЛЬКО продукты питания и напитки с чека. Игнорируй бытовые товары. Определи валюту чека (USD, EUR, RUB и т.д.). Верни ТОЛЬКО чистый JSON без markdown:

{
  "currency": "USD",
  "items": [
    {"name": "Название товара", "quantity": 1, "price": 1.49, "expiry_days": 7, "category": "veg", "icon": "❄️"}
  ]
}`;

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON не найден');
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  try {
    const { image, telegram_user_id, is_premium } = await req.json();

    if (!image) {
      return NextResponse.json({ error: 'Нет изображения' }, { status: 400 });
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    let text = '';

    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      text = await callClaudeViaWorker({
        userId: telegram_user_id,
        isPremium: Boolean(is_premium),
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
            },
            { type: 'text', text: PARSE_PROMPT },
          ],
        }],
      });
    } else {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Data },
            },
            { type: 'text', text: PARSE_PROMPT },
          ],
        }],
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PARSE RECEIPT ERROR:', message);
    return NextResponse.json({ error: 'Ошибка распознавания', details: message }, { status: 500 });
  }
}

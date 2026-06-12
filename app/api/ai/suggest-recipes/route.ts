import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json({ error: "Нет изображения" }, { status: 400 });
    }

    const base64Data = image.includes(',') ? image.split(',')[1] : image;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Data
            }
          },
          {
            type: "text",
            text: `Извлеки ТОЛЬКО продукты питания и напитки с чека. Игнорируй бытовые товары, косметику, электронику. Определи валюту чека (USD, EUR, RUB и т.д.). Верни ТОЛЬКО JSON объект без markdown:

{
  "currency": "USD",
  "items": [
    {"name": "Название товара", "quantity": 1, "price": 1.49, "expiry_days": 7, "category": "grain", "icon": "🌾"}
  ]
}`
          }
        ]
      }]
    });

    let text = response.content.map((b: any) => b.type === 'text' ? b.text : '').join('');
    text = text.replace(/```json|```/g, "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    const parsed = JSON.parse(match[0]);
    const items = parsed.items || [];
    const currency = parsed.currency || 'RUB';
    return NextResponse.json({ items, currency });

  } catch (error: any) {
    console.error("Claude error:", error.message);
    return NextResponse.json({ error: "Ошибка распознавания" }, { status: 500 });
  }
}
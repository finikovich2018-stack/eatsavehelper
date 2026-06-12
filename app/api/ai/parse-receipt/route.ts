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
      model: "claude-sonnet-4-20250514",   // ← рабочая модель
      max_tokens: 1500,
      temperature: 0,
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
            text: `Извлеки ТОЛЬКО продукты питания и напитки с чека. Игнорируй бытовые товары.

Определи валюту чека (USD, EUR, RUB и т.д.).

Верни ТОЛЬКО чистый JSON без markdown:

{
  "currency": "USD",
  "items": [
    {
      "name": "Название товара",
      "quantity": 1,
      "price": 1.49,
      "expiry_days": 7,
      "category": "veg",
      "icon": "🥬"
    }
  ]
}`
          }
        ]
      }]
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    let text = textBlock?.text || "";
    text = text.replace(/```json|```/g, "").trim();

    // Ищем JSON объект
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON не найден в ответе Claude");

    const parsed = JSON.parse(match[0]);

    return NextResponse.json({
      items: parsed.items || [],
      currency: parsed.currency || "RUB"
    });

  } catch (error: any) {
    console.error("=== CLAUDE ERROR ===");
    console.error(error);
    return NextResponse.json({
      error: "Ошибка распознавания",
      details: error.message || "Unknown error"
    }, { status: 500 });
  }
}
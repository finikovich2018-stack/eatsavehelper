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
      model: "claude-3-5-sonnet-20240620",
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
            text: `Проанализируй фото чека и извлеки все товары.

Определи валюту чека (RUB, EUR, USD, и т.д.).

Верни ТОЛЬКО чистый JSON массив без лишнего текста:

[
  {
    "name": "Название товара",
    "quantity": 1,
    "price": 115.00,
    "currency": "RUB",
    "expiry_days": 7,
    "category": "veg",
    "icon": "🥔"
  }
]
`
          }
        ]
      }]
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    let text = textBlock?.text || "";
    text = text.replace(/```json|```/g, "").trim();

    const items = JSON.parse(text);
    return NextResponse.json({ items });

    } catch (error: any) {
    console.error("=== CLAUDE ERROR ===");
    console.error(error);
    return NextResponse.json({ 
      error: "Ошибка распознавания", 
      details: error.message || "Unknown error"
    }, { status: 500 });
  }
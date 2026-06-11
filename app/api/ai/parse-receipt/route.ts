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
            text: `Извлеки все товары с чека. Верни ТОЛЬКО JSON массив без markdown:

[
  {"name": "Название товара", "quantity": 1, "price": 115, "expiry_days": 7, "category": "veg", "icon": "🥔"}
]`
          }
        ]
      }]
    });

    let text = response.content.map((b: any) => b.type === 'text' ? b.text : '').join('');
    text = text.replace(/```json|```/g, "").trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found");
    const items = JSON.parse(match[0]);
    return NextResponse.json({ items });

  } catch (error: any) {
    console.error("Claude error:", error.message);
    return NextResponse.json({ error: "Ошибка распознавания" }, { status: 500 });
  }
}
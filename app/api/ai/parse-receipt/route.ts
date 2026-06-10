import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 }
          },
          {
            type: "text",
            text: "Это фото кассового чека. Извлеки список продуктов питания. Верни ТОЛЬКО JSON массив без лишнего текста: [{\"name\": \"название\", \"category\": \"dairy|meat|veg|grains|other\", \"price\": число, \"expiry_days\": число, \"icon\": \"эмодзи\"}]"
          }
        ]
      }]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(clean);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: "Failed to parse receipt" }, { status: 500 });
  }
}

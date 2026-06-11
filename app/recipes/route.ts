import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { ingredients } = await req.json();
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `У меня в холодильнике есть: ${ingredients.join(', ')}.
        
Предложи 3 рецепта которые можно приготовить. Верни ТОЛЬКО JSON массив без markdown:

[
  {
    "name": "Название блюда",
    "icon": "🍳",
    "time": "20 мин",
    "ingredients": ["ингредиент1", "ингредиент2"],
    "steps": "Краткое описание приготовления в 2-3 предложения",
    "usesFromFridge": ["продукт из холодильника который используется"]
  }
]`
      }]
    });

    let text = response.content.map((b: any) => b.type === 'text' ? b.text : '').join('');
    text = text.replace(/```json|```/g, "").trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON");
    const recipes = JSON.parse(match[0]);
    return NextResponse.json({ recipes });
  } catch (error: any) {
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
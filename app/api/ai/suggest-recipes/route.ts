import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const supabase = createClient(
  'https://dyxksakpvdupgutwswlm.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5eGtzYWtwdmR1cGd1dHdzd2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NDAyMzAsImV4cCI6MjA5NjMxNjIzMH0.Zq26AkcECmNQxTNF3cmC1cS4T8-_TQCEDUzKMT1xcaA'
);

export async function POST(req: NextRequest) {
  try {
    const { ingredients, telegram_user_id } = await req.json();

    let finalIngredients = ingredients;

    // Если ingredients не переданы — берём из холодильника
    if (!finalIngredients || finalIngredients.length === 0) {
      if (telegram_user_id) {
        const { data } = await supabase
          .from('fridge_items')
          .select('name')
          .eq('telegram_user_id', String(telegram_user_id));
        finalIngredients = (data || []).map((i: any) => i.name);
      }
    }

    if (!finalIngredients || finalIngredients.length === 0) {
      return NextResponse.json({ recipes: [] });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `У меня в холодильнике есть: ${finalIngredients.join(', ')}.

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
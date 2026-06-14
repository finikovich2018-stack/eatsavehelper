import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dyxksakpvdupgutwswlm.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const anthropic = getAnthropic();

  try {
    const { ingredients, telegram_user_id } = await req.json();

    let finalIngredients = ingredients;

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
        content: `У меня в холодильнике есть: ${finalIngredients.join(', ')}. Предложи 3 рецепта которые можно приготовить. Верни ТОЛЬКО JSON массив без markdown:

[{"name":"Название","icon":"🍳","time":"20 мин","ingredients":[],"steps":"","usesFromFridge":[]}]`
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

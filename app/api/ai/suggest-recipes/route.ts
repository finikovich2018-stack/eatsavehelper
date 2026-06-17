import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callClaudeViaWorker } from '@/lib/ai';
import { CLAUDE_MODEL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const RECIPE_PROMPT = (ingredients: string[]) =>
  `У меня в холодильнике есть: ${ingredients.join(', ')}. Предложи 3 рецепта которые можно приготовить. Верни ТОЛЬКО JSON массив без markdown:

[{"name":"Название","icon":"🍳","time":"20 мин","ingredients":[],"steps":"","usesFromFridge":[]}]`;

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  try {
    const { ingredients, telegram_user_id, is_premium, save } = await req.json();

    let finalIngredients = ingredients;

    if (!finalIngredients || finalIngredients.length === 0) {
      if (telegram_user_id) {
        const { data } = await supabase
          .from('fridge_items')
          .select('name')
          .eq('telegram_user_id', String(telegram_user_id));
        finalIngredients = (data || []).map((i: { name: string }) => i.name);
      }
    }

    if (!finalIngredients || finalIngredients.length === 0) {
      return NextResponse.json({ recipes: [] });
    }

    let text = '';

    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      text = await callClaudeViaWorker({
        userId: telegram_user_id,
        isPremium: Boolean(is_premium),
        messages: [{ role: 'user', content: RECIPE_PROMPT(finalIngredients) }],
      });
    } else {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: RECIPE_PROMPT(finalIngredients) }],
      });

      text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }

    const cleaned = text.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON');
    const recipes = JSON.parse(match[0]);

    if (save && telegram_user_id && Array.isArray(recipes)) {
      const rows = recipes.map((recipe: {
        name: string;
        icon?: string;
        ingredients?: string[];
        steps?: string;
        usesFromFridge?: string[];
      }) => ({
        telegram_user_id,
        name: recipe.name,
        icon: recipe.icon || '🍳',
        ingredients: recipe.ingredients || recipe.usesFromFridge || [],
        steps: recipe.steps ? [recipe.steps] : [],
        source: 'ai',
      }));
      await supabase.from('saved_recipes').insert(rows);
    }

    return NextResponse.json({ recipes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

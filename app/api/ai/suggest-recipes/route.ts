import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { callClaudeViaWorker } from '@/lib/ai';
import { getClaudeModel } from '@/lib/ai-model';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { assertCanUseAiRecipes, UsageLimitError } from '@/lib/usage-limits';
import { isPremiumActive } from '@/lib/user-utils';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

const JSON_SHAPE_RU =
  '[{"name":"Название","icon":"🍳","time":"20 мин","ingredients":[],"steps":"","usesFromFridge":[]}]';
const JSON_SHAPE_EN =
  '[{"name":"Name","icon":"🍳","time":"20 min","ingredients":[],"steps":"","usesFromFridge":[]}]';

function buildRecipePrompt(
  ingredients: string[],
  opts: { budget?: boolean; locale?: string }
) {
  const list = ingredients.join(', ');
  const isEn = opts.locale === 'en';

  if (opts.budget) {
    return isEn
      ? `I have these products at home: ${list}. Suggest 3 budget-friendly recipes that use mostly what I already have and require as few extra cheap ingredients as possible. Prefer simple, affordable dishes. Return ONLY a JSON array without markdown:\n\n${JSON_SHAPE_EN}`
      : `У меня дома есть: ${list}. Предложи 3 бюджетных рецепта, которые используют в основном то, что уже есть, и требуют как можно меньше дешёвых докупок. Предпочитай простые и недорогие блюда. Верни ТОЛЬКО JSON массив без markdown:\n\n${JSON_SHAPE_RU}`;
  }

  return isEn
    ? `I have these products in my fridge: ${list}. Suggest 3 recipes I can cook. Return ONLY a JSON array without markdown:\n\n${JSON_SHAPE_EN}`
    : `У меня в холодильнике есть: ${list}. Предложи 3 рецепта которые можно приготовить. Верни ТОЛЬКО JSON массив без markdown:\n\n${JSON_SHAPE_RU}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const { ingredients, save, mode, locale } = body;
    const budget = mode === 'budget';

    let finalIngredients = ingredients;

    if (!finalIngredients || finalIngredients.length === 0) {
      const { data } = await supabase
        .from('fridge_items')
        .select('name')
        .eq('telegram_user_id', auth.userId);
      finalIngredients = (data || []).map((i: { name: string }) => i.name);
    }

    if (!finalIngredients || finalIngredients.length === 0) {
      return NextResponse.json({ recipes: [] });
    }

    const user = await assertCanUseAiRecipes(supabase, auth.userId);

    let text = '';

    const prompt = buildRecipePrompt(finalIngredients, { budget, locale });

    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      text = await callClaudeViaWorker({
        userId: auth.userId,
        isPremium: isPremiumActive(user),
        messages: [{ role: 'user', content: prompt }],
      });
    } else {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: getClaudeModel(),
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
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

    if (save && Array.isArray(recipes)) {
      const rows = recipes.map((recipe: {
        name: string;
        icon?: string;
        ingredients?: string[];
        steps?: string;
        usesFromFridge?: string[];
      }) => ({
        telegram_user_id: auth.userId,
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
    if (error instanceof UsageLimitError) {
      return NextResponse.json(
        { error: 'Достигнут лимит AI-рецептов', code: error.code },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

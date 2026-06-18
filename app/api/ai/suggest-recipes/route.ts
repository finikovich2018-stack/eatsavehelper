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

const RECIPE_PROMPT = (ingredients: string[]) =>
  `У меня в холодильнике есть: ${ingredients.join(', ')}. Предложи 3 рецепта которые можно приготовить. Верни ТОЛЬКО JSON массив без markdown:

[{"name":"Название","icon":"🍳","time":"20 мин","ingredients":[],"steps":"","usesFromFridge":[]}]`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const { ingredients, save } = body;

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

    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      text = await callClaudeViaWorker({
        userId: auth.userId,
        isPremium: isPremiumActive(user),
        messages: [{ role: 'user', content: RECIPE_PROMPT(finalIngredients) }],
      });
    } else {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: getClaudeModel(),
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

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FREE_AI_RECIPES_PER_MONTH,
  FREE_SCANS_PER_MONTH,
} from '@/lib/constants';
import { isPremiumActive } from '@/lib/user-utils';

type UserRow = {
  is_premium?: boolean | null;
  premium_until?: string | null;
  scans_this_month?: number | null;
  scans_month?: string | null;
  ai_recipes_this_month?: number | null;
  ai_recipes_month?: string | null;
};

export class UsageLimitError extends Error {
  code: 'scan_limit' | 'recipe_limit';

  constructor(code: 'scan_limit' | 'recipe_limit') {
    super(code === 'scan_limit' ? 'Scan limit reached' : 'Recipe limit reached');
    this.code = code;
  }
}

async function expirePremiumIfNeeded(
  supabase: SupabaseClient,
  userId: number,
  user: UserRow
): Promise<UserRow> {
  if (user.is_premium && user.premium_until && new Date(user.premium_until) <= new Date()) {
    const { data } = await supabase
      .from('users')
      .update({ is_premium: false })
      .eq('telegram_user_id', userId)
      .select('*')
      .maybeSingle();
    return data || { ...user, is_premium: false };
  }
  return user;
}

/** Load user, reset monthly counters, expire stale premium */
export async function getUserWithLimits(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<UserRow | null> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (!existing) return null;

  let user = await expirePremiumIfNeeded(supabase, telegramUserId, existing);

  if (user.scans_month !== currentMonth) {
    const { data: updated } = await supabase
      .from('users')
      .update({
        scans_this_month: 0,
        scans_month: currentMonth,
        ai_recipes_this_month: 0,
        ai_recipes_month: currentMonth,
      })
      .eq('telegram_user_id', telegramUserId)
      .select('*')
      .maybeSingle();
    user = updated || user;
  }

  return user;
}

export function canUseScan(user: UserRow | null): boolean {
  if (!user) return false;
  if (isPremiumActive(user)) return true;
  return (user.scans_this_month || 0) < FREE_SCANS_PER_MONTH;
}

export function canUseAiRecipes(user: UserRow | null): boolean {
  if (!user) return false;
  if (isPremiumActive(user)) return true;
  return (user.ai_recipes_this_month || 0) < FREE_AI_RECIPES_PER_MONTH;
}

export async function assertCanScan(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<UserRow> {
  const user = await getUserWithLimits(supabase, telegramUserId);
  if (!user || !canUseScan(user)) throw new UsageLimitError('scan_limit');
  return user;
}

export async function assertCanUseAiRecipes(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<UserRow> {
  const user = await getUserWithLimits(supabase, telegramUserId);
  if (!user || !canUseAiRecipes(user)) throw new UsageLimitError('recipe_limit');
  return user;
}

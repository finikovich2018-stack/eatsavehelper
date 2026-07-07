import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FREE_AI_RECIPES_PER_MONTH,
  FREE_SCANS_PER_MONTH,
} from '@/lib/constants';
import { hasEffectivePremium } from '@/lib/household';
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

export async function canUseScanAsync(
  supabase: SupabaseClient,
  telegramUserId: number,
  user: UserRow | null
): Promise<boolean> {
  if (!user) return false;
  if (await hasEffectivePremium(supabase, telegramUserId)) return true;
  return (user.scans_this_month || 0) < FREE_SCANS_PER_MONTH;
}

export function canUseAiRecipes(user: UserRow | null): boolean {
  if (!user) return false;
  if (isPremiumActive(user)) return true;
  return (user.ai_recipes_this_month || 0) < FREE_AI_RECIPES_PER_MONTH;
}

export async function canUseAiRecipesAsync(
  supabase: SupabaseClient,
  telegramUserId: number,
  user: UserRow | null
): Promise<boolean> {
  if (!user) return false;
  if (await hasEffectivePremium(supabase, telegramUserId)) return true;
  return (user.ai_recipes_this_month || 0) < FREE_AI_RECIPES_PER_MONTH;
}

export async function assertCanScan(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<UserRow> {
  const user = await getUserWithLimits(supabase, telegramUserId);
  if (!user || !(await canUseScanAsync(supabase, telegramUserId, user))) {
    throw new UsageLimitError('scan_limit');
  }
  return user;
}

export async function assertCanUseAiRecipes(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<UserRow> {
  const user = await getUserWithLimits(supabase, telegramUserId);
  if (!user || !(await canUseAiRecipesAsync(supabase, telegramUserId, user))) {
    throw new UsageLimitError('recipe_limit');
  }
  return user;
}

/** Reserve one free scan slot (compare-and-swap; safe under parallel requests). */
export async function consumeScanSlot(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<number> {
  if (await hasEffectivePremium(supabase, telegramUserId)) {
    const user = await getUserWithLimits(supabase, telegramUserId);
    return user?.scans_this_month || 0;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const user = await getUserWithLimits(supabase, telegramUserId);
    if (!user || (user.scans_this_month || 0) >= FREE_SCANS_PER_MONTH) {
      throw new UsageLimitError('scan_limit');
    }

    const current = user.scans_this_month || 0;
    const next = current + 1;
    const { data } = await supabase
      .from('users')
      .update({ scans_this_month: next })
      .eq('telegram_user_id', telegramUserId)
      .eq('scans_this_month', current)
      .select('scans_this_month')
      .maybeSingle();

    if (data) return data.scans_this_month ?? next;
  }

  throw new UsageLimitError('scan_limit');
}

/** Reserve one free AI recipe slot (compare-and-swap). */
export async function consumeRecipeSlot(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<number> {
  if (await hasEffectivePremium(supabase, telegramUserId)) {
    const user = await getUserWithLimits(supabase, telegramUserId);
    return user?.ai_recipes_this_month || 0;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const user = await getUserWithLimits(supabase, telegramUserId);
    if (!user || (user.ai_recipes_this_month || 0) >= FREE_AI_RECIPES_PER_MONTH) {
      throw new UsageLimitError('recipe_limit');
    }

    const current = user.ai_recipes_this_month || 0;
    const next = current + 1;
    const { data } = await supabase
      .from('users')
      .update({ ai_recipes_this_month: next })
      .eq('telegram_user_id', telegramUserId)
      .eq('ai_recipes_this_month', current)
      .select('ai_recipes_this_month')
      .maybeSingle();

    if (data) return data.ai_recipes_this_month ?? next;
  }

  throw new UsageLimitError('recipe_limit');
}

/**
 * Refund a previously consumed scan slot (CAS-safe). Call this when the
 * paid-for work (e.g. the AI call) fails AFTER consumeScanSlot succeeded,
 * so a transient error doesn't silently burn the user's free quota.
 */
export async function refundScanSlot(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: user } = await supabase
      .from('users')
      .select('scans_this_month')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    const current = user?.scans_this_month || 0;
    if (current <= 0) return;
    const next = current - 1;

    const { data } = await supabase
      .from('users')
      .update({ scans_this_month: next })
      .eq('telegram_user_id', telegramUserId)
      .eq('scans_this_month', current)
      .select('scans_this_month')
      .maybeSingle();

    if (data) return;
  }
}

/** Refund a previously consumed AI recipe slot (CAS-safe). See refundScanSlot. */
export async function refundRecipeSlot(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: user } = await supabase
      .from('users')
      .select('ai_recipes_this_month')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    const current = user?.ai_recipes_this_month || 0;
    if (current <= 0) return;
    const next = current - 1;

    const { data } = await supabase
      .from('users')
      .update({ ai_recipes_this_month: next })
      .eq('telegram_user_id', telegramUserId)
      .eq('ai_recipes_this_month', current)
      .select('ai_recipes_this_month')
      .maybeSingle();

    if (data) return;
  }
}

// NOTE: incrementScanCount/incrementRecipeCount (plain read-then-write,
// no compare-and-swap) were removed after a review found they could race
// under parallel requests, letting the free quota be bypassed or an
// increment silently lost. Use consumeScanSlot / consumeRecipeSlot instead
// — they perform an atomic CAS update and are safe under concurrency.

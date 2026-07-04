import type { SupabaseClient } from '@supabase/supabase-js';
import { TRIAL_PREMIUM_DAYS } from '@/lib/constants';

/** How long after signup we still grant a missed welcome trial (bot created user first). */
const WELCOME_TRIAL_GRACE_MS = 7 * 86400000;

export function trialPremiumUntil(from = new Date()): string {
  const until = new Date(from);
  until.setDate(until.getDate() + TRIAL_PREMIUM_DAYS);
  return until.toISOString();
}

export function welcomeTrialUserFields(currentMonth: string) {
  return {
    is_premium: true,
    premium_until: trialPremiumUntil(),
    scans_this_month: 0,
    scans_month: currentMonth,
    ai_recipes_this_month: 0,
    ai_recipes_month: currentMonth,
  };
}

/** Never had Premium (e.g. created via bot /start upsert without trial). */
export function isWelcomeTrialEligible(user: {
  is_premium?: boolean | null;
  premium_until?: string | null;
  created_at?: string | null;
}): boolean {
  if (user.premium_until) return false;
  if (user.is_premium) return false;
  if (user.created_at) {
    const age = Date.now() - new Date(user.created_at).getTime();
    if (age > WELCOME_TRIAL_GRACE_MS) return false;
  }
  return true;
}

/** Grant welcome trial once; safe to call on every login. Returns updated row or null. */
export async function grantWelcomeTrialIfEligible(
  supabase: SupabaseClient,
  telegramUserId: number,
  user: {
    is_premium?: boolean | null;
    premium_until?: string | null;
    created_at?: string | null;
  }
): Promise<Record<string, unknown> | null> {
  if (!isWelcomeTrialEligible(user)) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data, error } = await supabase
    .from('users')
    .update(welcomeTrialUserFields(currentMonth))
    .eq('telegram_user_id', telegramUserId)
    .is('premium_until', null)
    .or('is_premium.is.null,is_premium.eq.false')
    .select()
    .maybeSingle();

  if (error) {
    console.error('grantWelcomeTrial:', error.message);
    return null;
  }
  return data;
}

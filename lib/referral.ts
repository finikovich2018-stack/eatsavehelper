import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HOUSEHOLD_BOT_USERNAME,
  MAX_REFERRALS_PER_MONTH,
  REFERRAL_BONUS_DAYS,
  REFERRAL_MILESTONE,
  REFERRAL_MILESTONE_BONUS_DAYS,
  REFERRAL_NEW_USER_HOURS,
} from '@/lib/constants';
import { activatePremium } from '@/lib/premium';

function randomCode(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function referralLink(code: string): string {
  return `https://t.me/${HOUSEHOLD_BOT_USERNAME}?startapp=ref_${code}`;
}

export function parseReferralToken(token: string): string | null {
  const clean = String(token || '').trim().replace(/^ref_/, '');
  return clean || null;
}

export async function ensureReferralCode(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<string> {
  const { data: user } = await supabase
    .from('users')
    .select('referral_code')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (user?.referral_code) return user.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await supabase
      .from('users')
      .update({ referral_code: code })
      .eq('telegram_user_id', telegramUserId)
      .is('referral_code', null);

    if (!error) {
      const { data: updated } = await supabase
        .from('users')
        .select('referral_code')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      if (updated?.referral_code) return updated.referral_code;
    }
  }

  throw new Error('Failed to generate referral code');
}

export async function getReferralStats(supabase: SupabaseClient, telegramUserId: number) {
  const code = await ensureReferralCode(supabase, telegramUserId);
  const { count } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_telegram_user_id', telegramUserId);

  const { data: rows } = await supabase
    .from('referrals')
    .select('reward_days')
    .eq('referrer_telegram_user_id', telegramUserId);

  const bonusDays = (rows || []).reduce((sum, row) => sum + Number(row.reward_days || 0), 0);

  const invited = count || 0;
  const toNextMilestone = REFERRAL_MILESTONE - (invited % REFERRAL_MILESTONE);

  return {
    code,
    link: referralLink(code),
    invited,
    bonusDays,
    bonusPerInvite: REFERRAL_BONUS_DAYS,
    milestoneSize: REFERRAL_MILESTONE,
    milestoneBonusDays: REFERRAL_MILESTONE_BONUS_DAYS,
    toNextMilestone,
  };
}

export type ReferralClaimResult = {
  ok: true;
  alreadyClaimed?: boolean;
  bonusDays?: number;
  milestoneDays?: number;
  referrerId?: number;
  premiumUntil?: string | null;
};

export async function claimReferralByToken(
  supabase: SupabaseClient,
  refereeTelegramId: number,
  token: string
): Promise<ReferralClaimResult> {
  const code = parseReferralToken(token);
  if (!code) throw new Error('Invalid referral link');

  const { data: referrer } = await supabase
    .from('users')
    .select('telegram_user_id')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer) throw new Error('Referral link not found');
  if (referrer.telegram_user_id === refereeTelegramId) {
    throw new Error('Cannot use your own link');
  }

  const { data: referee } = await supabase
    .from('users')
    .select('telegram_user_id, referred_by, created_at')
    .eq('telegram_user_id', refereeTelegramId)
    .maybeSingle();

  if (!referee) throw new Error('User not found');
  if (referee.referred_by) return { ok: true, alreadyClaimed: true };

  const { data: existingReferral } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_telegram_user_id', refereeTelegramId)
    .maybeSingle();

  if (existingReferral) return { ok: true, alreadyClaimed: true };

  const createdAt = new Date(referee.created_at || Date.now());
  const hoursSinceCreate = (Date.now() - createdAt.getTime()) / 3_600_000;
  if (hoursSinceCreate > REFERRAL_NEW_USER_HOURS) {
    throw new Error('Referral only for new users');
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStart = `${currentMonth}-01T00:00:00.000Z`;
  const { count: monthCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_telegram_user_id', referrer.telegram_user_id)
    .gte('created_at', monthStart);

  if ((monthCount || 0) >= MAX_REFERRALS_PER_MONTH) {
    throw new Error('Referrer monthly limit reached');
  }

  const { count: totalInvited } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_telegram_user_id', referrer.telegram_user_id);

  const nextTotal = (totalInvited || 0) + 1;
  const milestoneDays =
    nextTotal % REFERRAL_MILESTONE === 0 ? REFERRAL_MILESTONE_BONUS_DAYS : 0;

  const premium = await activatePremium(
    referrer.telegram_user_id,
    REFERRAL_BONUS_DAYS + milestoneDays
  );

  const rewardedAt = new Date().toISOString();
  const { error: insertError } = await supabase.from('referrals').insert({
    referrer_telegram_user_id: referrer.telegram_user_id,
    referee_telegram_user_id: refereeTelegramId,
    reward_days: REFERRAL_BONUS_DAYS,
    rewarded_at: rewardedAt,
  });

  if (insertError) {
    if (insertError.code === '23505' || insertError.message.includes('unique')) {
      return { ok: true, alreadyClaimed: true };
    }
    throw new Error(insertError.message);
  }

  await supabase
    .from('users')
    .update({ referred_by: referrer.telegram_user_id })
    .eq('telegram_user_id', refereeTelegramId);

  return {
    ok: true,
    bonusDays: REFERRAL_BONUS_DAYS,
    milestoneDays,
    referrerId: referrer.telegram_user_id,
    premiumUntil: premium.premium_until,
  };
}

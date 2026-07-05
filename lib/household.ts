import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_HOUSEHOLD_MEMBERS } from '@/lib/constants';
import { isPremiumActive } from '@/lib/user-utils';

export type HouseholdRole = 'owner' | 'member';

export type HouseholdMember = {
  telegram_user_id: number;
  role: HouseholdRole;
  first_name: string | null;
  username: string | null;
};

export type HouseholdContext = {
  householdId: string;
  ownerTelegramId: number;
  role: HouseholdRole;
  memberCount: number;
  members: HouseholdMember[];
};

const DATA_TABLES = [
  'fridge_items',
  'expenses',
  'budgets',
  'receipts',
  'shopping_list_items',
] as const;

function randomToken(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function backfillHouseholdData(
  supabase: SupabaseClient,
  householdId: string,
  telegramUserId: number
) {
  for (const table of DATA_TABLES) {
    await supabase
      .from(table)
      .update({ household_id: householdId })
      .eq('telegram_user_id', telegramUserId)
      .is('household_id', null);
  }
}

async function loadMembers(
  supabase: SupabaseClient,
  householdId: string
): Promise<HouseholdMember[]> {
  const { data: rows } = await supabase
    .from('household_members')
    .select('telegram_user_id, role')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });

  if (!rows?.length) return [];

  const ids = rows.map((r) => r.telegram_user_id);
  const { data: users } = await supabase
    .from('users')
    .select('telegram_user_id, first_name, username')
    .in('telegram_user_id', ids);

  const byId = new Map((users || []).map((u) => [u.telegram_user_id, u]));

  return rows.map((r) => ({
    telegram_user_id: r.telegram_user_id,
    role: r.role as HouseholdRole,
    first_name: byId.get(r.telegram_user_id)?.first_name ?? null,
    username: byId.get(r.telegram_user_id)?.username ?? null,
  }));
}

export async function getHouseholdContext(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<HouseholdContext | null> {
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (!membership?.household_id) return null;

  const { data: household } = await supabase
    .from('households')
    .select('id, owner_telegram_user_id')
    .eq('id', membership.household_id)
    .maybeSingle();

  if (!household) return null;

  const members = await loadMembers(supabase, household.id);

  return {
    householdId: household.id,
    ownerTelegramId: household.owner_telegram_user_id,
    role: membership.role as HouseholdRole,
    memberCount: members.length,
    members,
  };
}

/** Ensure user belongs to a household (creates solo household if needed). */
export async function ensureHouseholdContext(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<HouseholdContext> {
  const existing = await getHouseholdContext(supabase, telegramUserId);
  if (existing) return existing;

  const { data: household, error: hErr } = await supabase
    .from('households')
    .insert({ owner_telegram_user_id: telegramUserId })
    .select('id, owner_telegram_user_id')
    .single();

  if (hErr || !household) {
    const retry = await getHouseholdContext(supabase, telegramUserId);
    if (retry) return retry;
    throw new Error(hErr?.message || 'Failed to create household');
  }

  const { error: memberErr } = await supabase.from('household_members').insert({
    household_id: household.id,
    telegram_user_id: telegramUserId,
    role: 'owner',
  });

  if (memberErr) {
    if (memberErr.code === '23505') {
      await supabase.from('households').delete().eq('id', household.id);
      const retry = await getHouseholdContext(supabase, telegramUserId);
      if (retry) return retry;
    }
    throw new Error(memberErr.message);
  }

  await supabase
    .from('users')
    .update({ household_id: household.id })
    .eq('telegram_user_id', telegramUserId);

  await backfillHouseholdData(supabase, household.id, telegramUserId);

  const members = await loadMembers(supabase, household.id);

  return {
    householdId: household.id,
    ownerTelegramId: household.owner_telegram_user_id,
    role: 'owner',
    memberCount: members.length,
    members,
  };
}

export async function ownerHasPremium(
  supabase: SupabaseClient,
  ctx: HouseholdContext
): Promise<boolean> {
  const { data: owner } = await supabase
    .from('users')
    .select('is_premium, premium_until')
    .eq('telegram_user_id', ctx.ownerTelegramId)
    .maybeSingle();

  return isPremiumActive(owner || {});
}

/** User premium OR household owner premium. */
export async function hasEffectivePremium(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('is_premium, premium_until')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (isPremiumActive(user || {})) return true;

  const ctx = await getHouseholdContext(supabase, telegramUserId);
  if (!ctx) return false;
  return ownerHasPremium(supabase, ctx);
}

export function householdInviteLink(token: string): string {
  return `https://t.me/EatSavehelper_bot?startapp=join_${token}`;
}

export async function createHouseholdInvite(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<{ token: string; link: string; expiresAt: string }> {
  const ctx = await ensureHouseholdContext(supabase, telegramUserId);

  if (ctx.role !== 'owner') {
    throw new Error('Only the household owner can invite');
  }

  const ownerPremium = await ownerHasPremium(supabase, ctx);
  if (!ownerPremium) {
    throw new Error('Premium required for family sharing');
  }

  if (ctx.memberCount >= MAX_HOUSEHOLD_MEMBERS) {
    throw new Error('Household is full');
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

  const { error } = await supabase.from('household_invites').insert({
    household_id: ctx.householdId,
    token,
    created_by: telegramUserId,
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);

  return { token, link: householdInviteLink(token), expiresAt };
}

async function migrateUserDataToHousehold(
  supabase: SupabaseClient,
  telegramUserId: number,
  householdId: string
) {
  for (const table of DATA_TABLES) {
    await supabase
      .from(table)
      .update({ household_id: householdId })
      .eq('telegram_user_id', telegramUserId);
  }

  await supabase
    .from('users')
    .update({ household_id: householdId })
    .eq('telegram_user_id', telegramUserId);
}

async function dissolveSoloHousehold(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<void> {
  const ctx = await getHouseholdContext(supabase, telegramUserId);
  if (!ctx || ctx.memberCount !== 1 || ctx.role !== 'owner') return;

  await supabase.from('household_members').delete().eq('telegram_user_id', telegramUserId);
  await supabase.from('households').delete().eq('id', ctx.householdId);
  await supabase
    .from('users')
    .update({ household_id: null })
    .eq('telegram_user_id', telegramUserId);
}

export async function joinHouseholdByToken(
  supabase: SupabaseClient,
  telegramUserId: number,
  token: string
): Promise<HouseholdContext> {
  const cleanToken = token.replace(/^join_/, '');

  const { data: invite } = await supabase
    .from('household_invites')
    .select('household_id, expires_at')
    .eq('token', cleanToken)
    .maybeSingle();

  if (!invite) throw new Error('Invite not found');
  if (new Date(invite.expires_at) <= new Date()) throw new Error('Invite expired');

  const targetCtx = await getHouseholdContext(supabase, telegramUserId);
  if (targetCtx?.householdId === invite.household_id) {
    return targetCtx as HouseholdContext;
  }

  if (targetCtx && targetCtx.memberCount > 1) {
    throw new Error('Leave your current family before joining another');
  }

  if (targetCtx) {
    await dissolveSoloHousehold(supabase, telegramUserId);
  }

  const { error: joinError } = await supabase.rpc('join_household_member', {
    p_user_id: telegramUserId,
    p_household_id: invite.household_id,
    p_max_members: MAX_HOUSEHOLD_MEMBERS,
  });

  if (joinError) {
    if (joinError.message.includes('household_full')) {
      throw new Error('This family is already full');
    }
    if (joinError.code === '23505') {
      const existing = await getHouseholdContext(supabase, telegramUserId);
      if (existing && existing.householdId === invite.household_id) return existing;
    }
    if (joinError.message.includes('does not exist')) {
      await joinHouseholdMemberLegacy(supabase, telegramUserId, invite.household_id);
    } else {
      throw new Error(joinError.message);
    }
  }

  await migrateUserDataToHousehold(supabase, telegramUserId, invite.household_id);

  const joined = await getHouseholdContext(supabase, telegramUserId);
  if (!joined) throw new Error('Failed to join household');
  return joined;
}

export async function leaveHousehold(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<HouseholdContext> {
  const ctx = await getHouseholdContext(supabase, telegramUserId);
  if (!ctx) return ensureHouseholdContext(supabase, telegramUserId);

  if (ctx.role === 'owner' && ctx.memberCount > 1) {
    throw new Error('Remove family members before leaving as owner');
  }

  if (ctx.role === 'member') {
    await supabase.from('household_members').delete().eq('telegram_user_id', telegramUserId);
    return ensureHouseholdContext(supabase, telegramUserId);
  }

  return ctx;
}

export async function removeHouseholdMember(
  supabase: SupabaseClient,
  ownerTelegramId: number,
  memberTelegramId: number
): Promise<HouseholdContext> {
  const ctx = await ensureHouseholdContext(supabase, ownerTelegramId);
  if (ctx.role !== 'owner') throw new Error('Only owner can remove members');
  if (memberTelegramId === ownerTelegramId) throw new Error('Cannot remove yourself');

  await supabase
    .from('household_members')
    .delete()
    .eq('telegram_user_id', memberTelegramId)
    .eq('household_id', ctx.householdId);

  await ensureHouseholdContext(supabase, memberTelegramId);

  return (await getHouseholdContext(supabase, ownerTelegramId)) || ctx;
}

async function joinHouseholdMemberLegacy(
  supabase: SupabaseClient,
  telegramUserId: number,
  householdId: string
) {
  const { count } = await supabase
    .from('household_members')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  if ((count || 0) >= MAX_HOUSEHOLD_MEMBERS) {
    throw new Error('This family is already full');
  }

  const { error: joinError } = await supabase.from('household_members').insert({
    household_id: householdId,
    telegram_user_id: telegramUserId,
    role: 'member',
  });

  if (joinError) throw new Error(joinError.message);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PREMIUM_DAYS = 30;

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, key);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Check that users table supports Premium columns */
export async function checkPremiumDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('users')
      .select('is_premium, premium_until')
      .limit(1);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

export async function activatePremium(telegramUserId: number) {
  const dbCheck = await checkPremiumDb();
  if (!dbCheck.ok) {
    throw new Error(
      `Premium columns missing: ${dbCheck.error}. Run supabase/patch_premium.sql in Supabase SQL Editor.`
    );
  }

  const supabase = getSupabase();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('premium_until')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`DB select: ${selectError.message}`);
  }

  const baseDate =
    existing?.premium_until && new Date(existing.premium_until) > now
      ? new Date(existing.premium_until)
      : now;

  const premiumUntil = addDays(baseDate, PREMIUM_DAYS).toISOString();

  const row: Record<string, unknown> = {
    telegram_user_id: telegramUserId,
    is_premium: true,
    premium_until: premiumUntil,
    updated_at: now.toISOString(),
  };

  if (!existing) {
    row.scans_month = currentMonth;
    row.ai_recipes_month = currentMonth;
    row.scans_this_month = 0;
    row.ai_recipes_this_month = 0;
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'telegram_user_id' })
    .select('is_premium, premium_until')
    .maybeSingle();

  if (error) {
    throw new Error(`DB upsert: ${error.message}`);
  }

  if (!data?.is_premium) {
    throw new Error('DB upsert: Premium flag not set');
  }

  return data;
}

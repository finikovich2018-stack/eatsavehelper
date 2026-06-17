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

export async function activatePremium(telegramUserId: number) {
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

  if (existing) {
    const { data, error } = await supabase
      .from('users')
      .update({
        is_premium: true,
        premium_until: premiumUntil,
        updated_at: now.toISOString(),
      })
      .eq('telegram_user_id', telegramUserId)
      .select('is_premium, premium_until')
      .maybeSingle();

    if (error) throw new Error(`DB update: ${error.message}`);
    if (!data) throw new Error('DB update: user row not found after update');
    return data;
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      telegram_user_id: telegramUserId,
      is_premium: true,
      premium_until: premiumUntil,
      scans_month: currentMonth,
      ai_recipes_month: currentMonth,
      scans_this_month: 0,
      ai_recipes_this_month: 0,
      updated_at: now.toISOString(),
    })
    .select('is_premium, premium_until')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('users')
        .update({
          is_premium: true,
          premium_until: premiumUntil,
          updated_at: now.toISOString(),
        })
        .eq('telegram_user_id', telegramUserId)
        .select('is_premium, premium_until')
        .maybeSingle();

      if (retryError) throw new Error(`DB update retry: ${retryError.message}`);
      if (!retry) throw new Error('DB update retry: user not found');
      return retry;
    }
    throw new Error(`DB insert: ${error.message}`);
  }

  return data;
}

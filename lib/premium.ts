import { supabaseAdmin } from '@/lib/supabase/admin';

const PREMIUM_DAYS = 30;

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function activatePremium(telegramUserId: number) {
  const now = new Date();

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id, premium_until')
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle();

  const baseDate =
    existing?.premium_until && new Date(existing.premium_until) > now
      ? new Date(existing.premium_until)
      : now;

  const premiumUntil = addDays(baseDate, PREMIUM_DAYS).toISOString();

  if (existing) {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ is_premium: true, premium_until: premiumUntil })
      .eq('telegram_user_id', telegramUserId);

    if (error) throw error;
    return;
  }

  const currentMonth = now.toISOString().slice(0, 7);
  const { error } = await supabaseAdmin.from('users').insert({
    telegram_user_id: telegramUserId,
    is_premium: true,
    premium_until: premiumUntil,
    scans_month: currentMonth,
    ai_recipes_month: currentMonth,
    scans_this_month: 0,
    ai_recipes_this_month: 0,
  });

  if (error) throw error;
}


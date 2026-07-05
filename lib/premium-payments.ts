import type { SupabaseClient } from '@supabase/supabase-js';
import { activatePremium } from '@/lib/premium';

/** Match Premium subscription length — payments within this window can restore access */
export const PREMIUM_PAYMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type PremiumPaymentResult = 'activated' | 'already_processed' | 'log_failed';

export async function logPremiumPayment(
  supabase: SupabaseClient,
  params: {
    telegramUserId: number;
    amount: number;
    currency: string;
    invoicePayload?: string;
    chargeId?: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('premium_payments')
    .insert({
      telegram_user_id: params.telegramUserId,
      amount: params.amount,
      currency: params.currency,
      invoice_payload: params.invoicePayload || null,
      telegram_payment_charge_id: params.chargeId || null,
      activated: false,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505' && params.chargeId) {
      const { data: existing } = await supabase
        .from('premium_payments')
        .select('id')
        .eq('telegram_payment_charge_id', params.chargeId)
        .maybeSingle();
      return existing?.id as string | null;
    }
    console.error('logPremiumPayment error:', error);
    return null;
  }
  return data?.id as string | null;
}

export async function markPaymentActivated(supabase: SupabaseClient, paymentId: string) {
  await supabase.from('premium_payments').update({ activated: true }).eq('id', paymentId);
}

export async function markLatestPaymentActivated(
  supabase: SupabaseClient,
  telegramUserId: number
) {
  const since = new Date(Date.now() - PREMIUM_PAYMENT_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('premium_payments')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .eq('activated', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) {
    await markPaymentActivated(supabase, data.id);
  }
}

/** Unactivated Stars payment in the last 30 days (webhook failed after charge). */
export async function hasRecoverablePremiumPayment(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<boolean> {
  const since = new Date(Date.now() - PREMIUM_PAYMENT_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('premium_payments')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .eq('activated', false)
    .gte('created_at', since)
    .limit(1);

  if (error) {
    console.error('hasRecoverablePremiumPayment error:', error);
    return false;
  }
  return (data?.length || 0) > 0;
}

async function findPaymentByChargeId(
  supabase: SupabaseClient,
  chargeId: string
): Promise<{ id: string; activated: boolean } | null> {
  const { data } = await supabase
    .from('premium_payments')
    .select('id, activated')
    .eq('telegram_payment_charge_id', chargeId)
    .maybeSingle();
  return data as { id: string; activated: boolean } | null;
}

/** Log + activate Premium once per Telegram charge id (webhook-safe). */
export async function processSuccessfulPremiumPayment(
  supabase: SupabaseClient,
  params: {
    telegramUserId: number;
    amount: number;
    currency: string;
    invoicePayload?: string;
    chargeId?: string;
  }
): Promise<PremiumPaymentResult> {
  if (params.chargeId) {
    const existing = await findPaymentByChargeId(supabase, params.chargeId);
    if (existing?.activated) return 'already_processed';
    if (existing && !existing.activated) {
      await activatePremium(params.telegramUserId);
      await markPaymentActivated(supabase, existing.id);
      return 'activated';
    }
  }

  const paymentId = await logPremiumPayment(supabase, params);
  if (!paymentId) return 'log_failed';

  const { data: row } = await supabase
    .from('premium_payments')
    .select('activated')
    .eq('id', paymentId)
    .maybeSingle();

  if (row?.activated) return 'already_processed';

  await activatePremium(params.telegramUserId);
  await markPaymentActivated(supabase, paymentId);
  return 'activated';
}

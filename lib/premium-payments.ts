import type { SupabaseClient } from '@supabase/supabase-js';

const RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function logPremiumPayment(
  supabase: SupabaseClient,
  params: {
    telegramUserId: number;
    amount: number;
    currency: string;
    invoicePayload?: string;
    chargeId?: string;
  }
) {
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
  const since = new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString();
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

/** True if user has a Stars payment in the last 7 days not yet linked to active premium recovery */
export async function hasRecoverablePremiumPayment(
  supabase: SupabaseClient,
  telegramUserId: number
): Promise<boolean> {
  const since = new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString();
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

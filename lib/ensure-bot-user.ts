import type { SupabaseClient } from '@supabase/supabase-js';
import { grantWelcomeTrialIfEligible, welcomeTrialUserFields } from '@/lib/welcome-trial';

/** Create or update a user row from the Telegram bot (with welcome trial on first insert). */
export async function ensureBotUser(
  supabase: SupabaseClient,
  chatId: number,
  patch: { notifications_enabled?: boolean } = {}
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: existing } = await supabase
    .from('users')
    .select('telegram_user_id, is_premium, premium_until, created_at')
    .eq('telegram_user_id', chatId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('users').insert({
      telegram_user_id: chatId,
      telegram_chat_id: chatId,
      notifications_enabled: patch.notifications_enabled ?? true,
      ...welcomeTrialUserFields(currentMonth),
    });

    if (error?.code === '23505') {
      await supabase
        .from('users')
        .update({
          telegram_chat_id: chatId,
          ...(patch.notifications_enabled !== undefined
            ? { notifications_enabled: patch.notifications_enabled }
            : {}),
        })
        .eq('telegram_user_id', chatId);
      return;
    }

    if (error) {
      console.error('ensureBotUser insert:', error.message);
    }
    return;
  }

  await supabase
    .from('users')
    .update({
      telegram_chat_id: chatId,
      ...(patch.notifications_enabled !== undefined
        ? { notifications_enabled: patch.notifications_enabled }
        : {}),
    })
    .eq('telegram_user_id', chatId);

  await grantWelcomeTrialIfEligible(supabase, chatId, existing);
}

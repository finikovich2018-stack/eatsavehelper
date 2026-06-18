import type { SupabaseClient } from '@supabase/supabase-js';

type TgProfile = {
  first_name?: string;
  username?: string | null;
};

/** Save Telegram display name when users table has profile columns. */
export async function syncUserProfile(
  supabase: SupabaseClient,
  telegramUserId: number,
  tgUser: TgProfile
) {
  const patch: Record<string, unknown> = {};
  if (tgUser.first_name) patch.first_name = tgUser.first_name;
  if (tgUser.username !== undefined) patch.username = tgUser.username || null;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from('users')
    .update(patch)
    .eq('telegram_user_id', telegramUserId);

  // Legacy DB without profile columns — ignore
  if (error?.code === '42703') return;
  if (error) console.error('syncUserProfile:', error.message);
}

export function userDisplayLabel(user: {
  telegram_user_id: number;
  first_name?: string | null;
  username?: string | null;
}) {
  if (user.first_name?.trim()) return user.first_name.trim();
  if (user.username?.trim()) return `@${user.username.replace(/^@/, '')}`;
  return `ID ${user.telegram_user_id}`;
}

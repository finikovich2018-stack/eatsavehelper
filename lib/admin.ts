/** Comma-separated Telegram user IDs from ADMIN_TELEGRAM_IDS env. */
export function getAdminTelegramIds(): number[] {
  const raw = process.env.ADMIN_TELEGRAM_IDS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function isAdminTelegramId(telegramUserId: number): boolean {
  const admins = getAdminTelegramIds();
  return admins.length > 0 && admins.includes(telegramUserId);
}

/** Telegram bot token from env, trimmed and validated */
export function getBotToken(): string {
  const raw = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
  const token = raw.trim();

  if (!token || token.includes('placeholder') || token === 'TELEGRAM_BOT_TOKEN') {
    return '';
  }

  return token;
}

export function isBotTokenConfigured(): boolean {
  return Boolean(getBotToken());
}

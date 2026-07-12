import crypto from 'crypto';
import { getBotToken } from '@/lib/bot-token';

export interface TelegramLoginPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Verifies the payload returned by the Telegram Login Widget
 * (https://core.telegram.org/widgets/login#checking-authorization).
 * This uses a different signing scheme than Mini App initData:
 * secret_key = SHA256(bot_token), not HMAC-SHA256("WebAppData", bot_token).
 */
export function verifyTelegramLoginWidget(payload: TelegramLoginPayload): boolean {
  const botToken = getBotToken();
  if (!botToken) return false;
  if (!payload?.id || !payload.hash || !payload.auth_date) return false;

  const { hash, ...rest } = payload;
  const dataCheckString = Object.entries(rest)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return false;

  // Reject stale or clock-skewed login attempts.
  const ageSeconds = Date.now() / 1000 - payload.auth_date;
  if (ageSeconds > 86_400 || ageSeconds < -60) return false;

  return true;
}

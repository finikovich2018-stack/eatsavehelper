import crypto from 'crypto';
import { getBotToken } from '@/lib/bot-token';

export interface SyntheticSessionUser {
  id: number;
  first_name: string;
  username?: string;
}

/**
 * Mints an initData-shaped string signed the same way real Telegram Mini App
 * initData is signed (see lib/telegram.ts:verifyTelegramInitData). We control
 * both the signing (here) and verification (existing verifyApiUser) sides, so
 * this lets browser logins (via the Telegram Login Widget) reuse the entire
 * existing Mini App auth/session pipeline unchanged — no API route needs to
 * know the difference between a real Telegram launch and a web login.
 */
export function mintSyntheticInitData(user: SyntheticSessionUser): string {
  const botToken = getBotToken();
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}

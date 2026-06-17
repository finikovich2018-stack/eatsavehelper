import crypto from 'crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

export function parseTelegramUser(initData: string): TelegramWebAppUser | null {
  const userStr = new URLSearchParams(initData).get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as TelegramWebAppUser;
  } catch {
    return null;
  }
}

export function getInitDataAuthDate(initData: string): number | null {
  const authDate = new URLSearchParams(initData).get('auth_date');
  return authDate ? Number(authDate) : null;
}

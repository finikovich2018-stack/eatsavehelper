import { getBotToken } from '@/lib/bot-token';
import {
  getInitDataAuthDate,
  parseTelegramUser,
  verifyTelegramInitData,
  type TelegramWebAppUser,
} from '@/lib/telegram';

export type VerifyApiUserResult =
  | { ok: true; userId: number; tgUser: TelegramWebAppUser }
  | { ok: false; error: string; status: number };

/** Verify Telegram Mini App initData and resolve the authenticated user id. */
export function verifyApiUser(body: {
  initData?: string;
  telegram_user_id?: number | string;
}): VerifyApiUserResult {
  const { initData, telegram_user_id } = body;

  if (!initData) {
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.ALLOW_DEV_AUTH === 'true' &&
      telegram_user_id
    ) {
      return {
        ok: true,
        userId: Number(telegram_user_id),
        tgUser: { id: Number(telegram_user_id), first_name: 'Dev' },
      };
    }
    return { ok: false, error: 'Missing initData', status: 401 };
  }

  const botToken = getBotToken();
  if (!botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured', status: 500 };
  }

  if (!verifyTelegramInitData(initData, botToken)) {
    return { ok: false, error: 'Invalid initData', status: 401 };
  }

  const authDate = getInitDataAuthDate(initData);
  if (authDate && Date.now() / 1000 - authDate > 86_400) {
    return { ok: false, error: 'initData expired', status: 401 };
  }

  const tgUser = parseTelegramUser(initData);
  if (!tgUser) {
    return { ok: false, error: 'Invalid user in initData', status: 401 };
  }

  if (telegram_user_id != null && Number(telegram_user_id) !== tgUser.id) {
    return { ok: false, error: 'User mismatch', status: 403 };
  }

  return { ok: true, userId: tgUser.id, tgUser };
}

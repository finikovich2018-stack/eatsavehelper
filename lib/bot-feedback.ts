import { getAdminTelegramIds, isAdminTelegramId } from '@/lib/admin';
import { FEEDBACK_CHANNEL_URL } from '@/lib/constants';

/** Post URL for channel comments (e.g. https://t.me/EatSavehelper/42). Falls back to channel. */
export function getFeedbackCommentUrl(): string {
  const post = process.env.FEEDBACK_CHANNEL_POST_URL?.trim();
  return post || FEEDBACK_CHANNEL_URL;
}

type FeedbackFrom = {
  id: number;
  first_name?: string;
  username?: string;
};

async function tgApi(botToken: string, method: string, body: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Forward a user message to all admins configured in ADMIN_TELEGRAM_IDS. */
export async function relayFeedbackToAdmins(
  botToken: string,
  sourceChatId: number,
  messageId: number,
  from: FeedbackFrom
): Promise<boolean> {
  const admins = getAdminTelegramIds();
  if (admins.length === 0 || isAdminTelegramId(from.id)) {
    return false;
  }

  const who = `${from.first_name || 'User'}${from.username ? ` (@${from.username})` : ''} · id ${from.id}`;

  for (const adminId of admins) {
    await tgApi(botToken, 'sendMessage', {
      chat_id: adminId,
      text: `📩 Сообщение от пользователя EatSave\n${who}`,
    });
    await tgApi(botToken, 'forwardMessage', {
      chat_id: adminId,
      from_chat_id: sourceChatId,
      message_id: messageId,
    });
  }

  return true;
}

import { getAdminTelegramIds } from '@/lib/admin';
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

export type FeedbackMessage = {
  text?: string;
  caption?: string;
  photo?: unknown[];
  document?: { file_name?: string };
  voice?: unknown;
  video?: unknown;
  sticker?: { emoji?: string };
};

async function tgApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!data.ok) {
    console.error(`Telegram ${method} failed:`, data.description || res.status);
  }
  return { ok: Boolean(data.ok), description: data.description };
}

function feedbackContentPreview(message?: FeedbackMessage): string | null {
  if (!message) return null;

  const text = message.text?.trim();
  if (text) return text;

  const caption = message.caption?.trim();
  if (caption) return caption;

  if (message.photo?.length) return '📷 Фото (без подписи)';
  if (message.document) return `📎 ${message.document.file_name || 'Файл'}`;
  if (message.voice) return '🎤 Голосовое сообщение';
  if (message.video) return '🎬 Видео';
  if (message.sticker) {
    return message.sticker.emoji
      ? `🎭 Стикер ${message.sticker.emoji}`
      : '🎭 Стикер';
  }

  return null;
}

function buildAdminNotice(from: FeedbackFrom, message?: FeedbackMessage): string {
  const who = `${from.first_name || 'User'}${from.username ? ` (@${from.username})` : ''} · id ${from.id}`;
  const preview = feedbackContentPreview(message);

  if (preview) {
    return `📩 Сообщение от пользователя EatSave\n${who}\n\n${preview}`;
  }

  return `📩 Сообщение от пользователя EatSave\n${who}\n\n(медиа — см. пересланное ниже)`;
}

/** Forward a user message to all admins configured in ADMIN_TELEGRAM_IDS. */
export async function relayFeedbackToAdmins(
  botToken: string,
  sourceChatId: number,
  messageId: number,
  from: FeedbackFrom,
  message?: FeedbackMessage
): Promise<boolean> {
  const admins = getAdminTelegramIds();
  if (admins.length === 0) {
    return false;
  }

  for (const adminId of admins) {
    await tgApi(botToken, 'sendMessage', {
      chat_id: adminId,
      text: buildAdminNotice(from, message),
    });

    const forwarded = await tgApi(botToken, 'forwardMessage', {
      chat_id: adminId,
      from_chat_id: sourceChatId,
      message_id: messageId,
    });

    if (!forwarded.ok) {
      const copied = await tgApi(botToken, 'copyMessage', {
        chat_id: adminId,
        from_chat_id: sourceChatId,
        message_id: messageId,
      });

      if (!copied.ok) {
        await tgApi(botToken, 'sendMessage', {
          chat_id: adminId,
          text: '⚠️ Не удалось переслать сообщение пользователя. Попросите написать ещё раз или проверьте логи бота.',
        });
      }
    }
  }

  return true;
}

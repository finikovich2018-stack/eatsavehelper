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

type MediaFile = { file_id: string };

export type FeedbackMessage = {
  text?: string;
  caption?: string;
  photo?: MediaFile[];
  document?: MediaFile & { file_name?: string };
  voice?: MediaFile;
  video?: MediaFile;
  video_note?: MediaFile;
  audio?: MediaFile;
  sticker?: MediaFile & { emoji?: string };
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
  if (message.video_note) return '🎥 Кружок';
  if (message.audio) return '🎵 Аудио';
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
    return `📩 Сообщение от пользователя EatSave\n${who}\n\n${preview}\n\n↩️ Ответьте на это сообщение — текст уйдёт пользователю.`;
  }

  return `📩 Сообщение от пользователя EatSave\n${who}\n\n(медиа — см. ниже)\n\n↩️ Ответьте на это сообщение — текст уйдёт пользователю.`;
}

async function sendMediaToAdmin(
  botToken: string,
  adminId: number,
  message?: FeedbackMessage
): Promise<{ ok: boolean; description?: string }> {
  if (!message) return { ok: false, description: 'no message' };

  const caption = message.caption?.trim() || undefined;

  if (message.photo?.length) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    return tgApi(botToken, 'sendPhoto', {
      chat_id: adminId,
      photo: fileId,
      caption,
    });
  }

  if (message.document?.file_id) {
    return tgApi(botToken, 'sendDocument', {
      chat_id: adminId,
      document: message.document.file_id,
      caption,
    });
  }

  if (message.voice?.file_id) {
    return tgApi(botToken, 'sendVoice', {
      chat_id: adminId,
      voice: message.voice.file_id,
      caption,
    });
  }

  if (message.video?.file_id) {
    return tgApi(botToken, 'sendVideo', {
      chat_id: adminId,
      video: message.video.file_id,
      caption,
    });
  }

  if (message.video_note?.file_id) {
    return tgApi(botToken, 'sendVideoNote', {
      chat_id: adminId,
      video_note: message.video_note.file_id,
    });
  }

  if (message.audio?.file_id) {
    return tgApi(botToken, 'sendAudio', {
      chat_id: adminId,
      audio: message.audio.file_id,
      caption,
    });
  }

  if (message.sticker?.file_id) {
    return tgApi(botToken, 'sendSticker', {
      chat_id: adminId,
      sticker: message.sticker.file_id,
    });
  }

  return { ok: false, description: 'unsupported media type' };
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

    if (forwarded.ok) continue;

    const copied = await tgApi(botToken, 'copyMessage', {
      chat_id: adminId,
      from_chat_id: sourceChatId,
      message_id: messageId,
    });

    if (copied.ok) continue;

    const media = await sendMediaToAdmin(botToken, adminId, message);
    if (media.ok) continue;

    const preview = feedbackContentPreview(message);
    const reason = media.description || copied.description || forwarded.description || 'unknown';
    await tgApi(botToken, 'sendMessage', {
      chat_id: adminId,
      text: preview
        ? `⚠️ Медиа не переслалось (${reason}). Текст выше — ответьте на уведомление 📩.`
        : `⚠️ Не удалось переслать сообщение (${reason}). Попросите написать ещё раз текстом.`,
    });
  }

  return true;
}

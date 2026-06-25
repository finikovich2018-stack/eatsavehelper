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

type ContactInfo = {
  phone_number?: string;
  first_name?: string;
  last_name?: string;
};

type LocationInfo = {
  latitude: number;
  longitude: number;
};

type PollInfo = {
  question?: string;
};

export type FeedbackMessage = {
  text?: string;
  caption?: string;
  photo?: MediaFile[];
  document?: MediaFile & { file_name?: string; mime_type?: string };
  voice?: MediaFile;
  video?: MediaFile;
  video_note?: MediaFile;
  audio?: MediaFile;
  sticker?: MediaFile & { emoji?: string };
  animation?: MediaFile;
  contact?: ContactInfo;
  location?: LocationInfo;
  venue?: LocationInfo & { title?: string; address?: string };
  poll?: PollInfo;
  /** Telegram message keys present (for debugging unsupported types). */
  kinds?: string[];
};

type TelegramMessageLike = Record<string, unknown>;

function detectMessageKinds(msg: TelegramMessageLike): string[] {
  const keys = [
    'text',
    'photo',
    'document',
    'voice',
    'video',
    'video_note',
    'audio',
    'sticker',
    'animation',
    'contact',
    'location',
    'venue',
    'poll',
    'dice',
    'game',
    'invoice',
    'story',
  ];
  return keys.filter((key) => msg[key] != null);
}

/** Map a Telegram message object to feedback payload (pass through all supported media fields). */
export function parseFeedbackMessage(msg: TelegramMessageLike): FeedbackMessage {
  return {
    text: typeof msg.text === 'string' ? msg.text : undefined,
    caption: typeof msg.caption === 'string' ? msg.caption : undefined,
    photo: Array.isArray(msg.photo) ? (msg.photo as MediaFile[]) : undefined,
    document: msg.document as FeedbackMessage['document'],
    voice: msg.voice as MediaFile,
    video: msg.video as MediaFile,
    video_note: msg.video_note as MediaFile,
    audio: msg.audio as MediaFile,
    sticker: msg.sticker as FeedbackMessage['sticker'],
    animation: msg.animation as MediaFile,
    contact: msg.contact as ContactInfo,
    location: msg.location as LocationInfo,
    venue: msg.venue as FeedbackMessage['venue'],
    poll: msg.poll as PollInfo,
    kinds: detectMessageKinds(msg),
  };
}

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
  if (message.document) {
    return `📎 ${message.document.file_name || message.document.mime_type || 'Файл'}`;
  }
  if (message.voice) return '🎤 Голосовое сообщение';
  if (message.video) return '🎬 Видео';
  if (message.video_note) return '🎥 Кружок';
  if (message.audio) return '🎵 Аудио';
  if (message.animation) return '🎞 GIF / анимация';
  if (message.sticker) {
    return message.sticker.emoji
      ? `🎭 Стикер ${message.sticker.emoji}`
      : '🎭 Стикер';
  }
  if (message.contact) {
    const name = [message.contact.first_name, message.contact.last_name]
      .filter(Boolean)
      .join(' ');
    return `👤 Контакт: ${name || 'без имени'}${message.contact.phone_number ? ` · ${message.contact.phone_number}` : ''}`;
  }
  if (message.location) {
    return `📍 Геолокация: ${message.location.latitude}, ${message.location.longitude}`;
  }
  if (message.venue) {
    return `📍 ${message.venue.title || 'Место'}${message.venue.address ? `\n${message.venue.address}` : ''}`;
  }
  if (message.poll?.question) return `📊 Опрос: ${message.poll.question}`;
  if (message.kinds?.length) return `📎 ${message.kinds.join(', ')}`;

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

  if (message.animation?.file_id) {
    return tgApi(botToken, 'sendAnimation', {
      chat_id: adminId,
      animation: message.animation.file_id,
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

  if (message.location) {
    return tgApi(botToken, 'sendLocation', {
      chat_id: adminId,
      latitude: message.location.latitude,
      longitude: message.location.longitude,
    });
  }

  if (message.venue?.latitude != null && message.venue?.longitude != null) {
    const sent = await tgApi(botToken, 'sendVenue', {
      chat_id: adminId,
      latitude: message.venue.latitude,
      longitude: message.venue.longitude,
      title: message.venue.title || 'Место',
      address: message.venue.address || '',
    });
    if (sent.ok) return sent;
  }

  const preview = feedbackContentPreview(message);
  if (preview) {
    return tgApi(botToken, 'sendMessage', {
      chat_id: adminId,
      text: preview,
    });
  }

  const kinds = message.kinds?.join(', ') || 'unknown';
  return { ok: false, description: `unsupported media type (${kinds})` };
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
        : `⚠️ Не удалось переслать сообщение (${reason}). Попросите написать ещё раз текстом или фото.`,
    });
  }

  return true;
}

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

const MESSAGE_META_KEYS = new Set([
  'message_id',
  'from',
  'chat',
  'date',
  'edit_date',
  'reply_to_message',
  'via_bot',
  'entities',
  'caption_entities',
  'link_preview_options',
  'effect_id',
  'message_thread_id',
  'is_topic_message',
  'is_automatic_forward',
  'reply_markup',
  'author_signature',
  'sender_chat',
  'forward_origin',
  'forward_from',
  'forward_from_chat',
  'forward_from_message_id',
  'forward_signature',
  'forward_sender_name',
  'forward_date',
  'has_protected_content',
  'media_group_id',
  'has_media_spoiler',
  'show_caption_above_media',
  'external_reply',
  'quote',
  'reply_to_story',
]);

type FoundFile = { file_id: string; source: string; mime?: string };

function detectMessageKinds(msg: TelegramMessageLike): string[] {
  const keys = [
    'text',
    'caption',
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
    'paid_media',
    'giveaway',
    'giveaway_winners',
    'web_app_data',
    'users_shared',
    'chat_shared',
  ];
  const found = keys.filter((key) => msg[key] != null);
  if (found.length > 0) return found;

  return Object.keys(msg).filter((key) => !MESSAGE_META_KEYS.has(key) && msg[key] != null);
}

function findFileIds(value: unknown, source = 'message', depth = 0): FoundFile[] {
  if (depth > 8 || value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findFileIds(item, `${source}[${index}]`, depth + 1));
  }

  if (typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const found: FoundFile[] = [];

  if (typeof record.file_id === 'string') {
    found.push({
      file_id: record.file_id,
      source,
      mime: typeof record.mime_type === 'string' ? record.mime_type : undefined,
    });
  }

  for (const [key, nested] of Object.entries(record)) {
    if (key === 'file_id') continue;
    found.push(...findFileIds(nested, `${source}.${key}`, depth + 1));
  }

  return found;
}

function dedupeFiles(files: FoundFile[]): FoundFile[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.file_id)) return false;
    seen.add(file.file_id);
    return true;
  });
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

async function sendFileIdToAdmin(
  botToken: string,
  adminId: number,
  file: FoundFile,
  caption?: string
): Promise<{ ok: boolean; description?: string }> {
  const source = file.source.toLowerCase();
  const mime = file.mime?.toLowerCase() || '';

  const attempts: Array<{ method: string; param: string }> = [];
  if (source.includes('photo') || mime.startsWith('image/')) {
    attempts.push({ method: 'sendPhoto', param: 'photo' });
  } else if (source.includes('animation') || mime === 'image/gif') {
    attempts.push({ method: 'sendAnimation', param: 'animation' });
  } else if (source.includes('video_note')) {
    attempts.push({ method: 'sendVideoNote', param: 'video_note' });
  } else if (source.includes('voice')) {
    attempts.push({ method: 'sendVoice', param: 'voice' });
  } else if (source.includes('audio') || mime.startsWith('audio/')) {
    attempts.push({ method: 'sendAudio', param: 'audio' });
  } else if (source.includes('sticker')) {
    attempts.push({ method: 'sendSticker', param: 'sticker' });
  } else if (source.includes('video') || mime.startsWith('video/')) {
    attempts.push({ method: 'sendVideo', param: 'video' });
  }

  attempts.push({ method: 'sendDocument', param: 'document' });

  for (const attempt of attempts) {
    const body: Record<string, unknown> = {
      chat_id: adminId,
      [attempt.param]: file.file_id,
    };
    if (caption && attempt.method !== 'sendVideoNote' && attempt.method !== 'sendSticker') {
      body.caption = caption;
    }
    const sent = await tgApi(botToken, attempt.method, body);
    if (sent.ok) return sent;
  }

  return { ok: false, description: 'file_id send failed' };
}

async function sendMediaToAdmin(
  botToken: string,
  adminId: number,
  message?: FeedbackMessage,
  raw?: TelegramMessageLike
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
    const sent = await tgApi(botToken, 'sendMessage', {
      chat_id: adminId,
      text: preview,
    });
    if (sent.ok) return sent;
  }

  const discovered = dedupeFiles(findFileIds(raw ?? {}));
  for (const file of discovered) {
    const sent = await sendFileIdToAdmin(botToken, adminId, file, caption);
    if (sent.ok) return sent;
  }

  const kinds = message.kinds?.join(', ') || detectMessageKinds(raw ?? {}).join(', ') || 'unknown';
  console.error('Feedback media relay failed:', { kinds, discovered: discovered.map((f) => f.source) });
  return { ok: false, description: `unsupported media type (${kinds})` };
}

/** Forward a user message to all admins configured in ADMIN_TELEGRAM_IDS. */
export async function relayFeedbackToAdmins(
  botToken: string,
  sourceChatId: number,
  messageId: number,
  from: FeedbackFrom,
  message?: FeedbackMessage,
  rawMessage?: TelegramMessageLike
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

    const media = await sendMediaToAdmin(botToken, adminId, message, rawMessage);
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

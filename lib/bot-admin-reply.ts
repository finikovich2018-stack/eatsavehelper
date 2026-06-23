import { botMsg } from '@/lib/bot-messages';

type ReplyTargetMessage = {
  text?: string;
  forward_from?: { id: number };
  forward_origin?: {
    type?: string;
    sender_user?: { id: number };
  };
};

export function parseReplyCommand(
  text: string
): { userId: number; body: string } | null {
  const match = text.match(/^\/reply(?:@\w+)?\s+(\d+)\s+([\s\S]+)/i);
  if (!match) return null;

  const userId = Number(match[1]);
  const body = match[2].trim();
  if (!Number.isFinite(userId) || userId <= 0 || !body) return null;

  return { userId, body };
}

/** Resolve Telegram user id from an admin reply to a feedback notification or forwarded message. */
export function resolveFeedbackUserId(replyTo?: ReplyTargetMessage): number | null {
  if (!replyTo) return null;

  if (replyTo.forward_origin?.type === 'user' && replyTo.forward_origin.sender_user?.id) {
    return replyTo.forward_origin.sender_user.id;
  }

  if (replyTo.forward_from?.id) {
    return replyTo.forward_from.id;
  }

  if (replyTo.text) {
    const match = replyTo.text.match(/· id (\d+)/);
    if (match) {
      const userId = Number(match[1]);
      if (Number.isFinite(userId) && userId > 0) return userId;
    }
  }

  return null;
}

export async function sendAdminReplyToUser(
  botToken: string,
  userTelegramId: number,
  text: string,
  locale: 'ru' | 'en' = 'ru'
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: userTelegramId,
      text: botMsg(locale).userSupportReply(text),
    }),
  });

  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!data.ok) {
    console.error('sendAdminReplyToUser failed:', data.description || res.status);
  }

  return { ok: Boolean(data.ok), description: data.description };
}

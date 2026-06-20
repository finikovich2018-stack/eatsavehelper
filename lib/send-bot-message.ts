import { getAppHomeUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';

/** Send a Telegram bot message; returns false if token missing or send failed. */
export async function sendBotMessage(
  chatId: number,
  text: string,
  options?: { buttonText?: string }
): Promise<boolean> {
  const botToken = getBotToken();
  if (!botToken || !Number.isFinite(chatId) || chatId <= 0) return false;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };

  if (options?.buttonText) {
    payload.reply_markup = {
      inline_keyboard: [[
        { text: options.buttonText, web_app: { url: getAppHomeUrl() } },
      ]],
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

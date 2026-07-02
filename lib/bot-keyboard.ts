import type { botLocale } from '@/lib/bot-messages';
import { getAppHomeUrl } from '@/lib/app-url';

type BotLocale = ReturnType<typeof botLocale>;

export const BOT_MENU_BTN = {
  ru: {
    openApp: '📱 Открыть EatSave',
    support: '✉️ Написать поддержку',
    channel: '💬 Комментарий в канале',
    premiumStatus: '⭐ Статус Premium',
    help: '❓ Помощь',
  },
  en: {
    openApp: '📱 Open EatSave',
    support: '✉️ Contact support',
    channel: '💬 Channel comment',
    premiumStatus: '⭐ Premium status',
    help: '❓ Help',
  },
} as const;

export type BotMenuAction = 'support' | 'channel' | 'status' | 'help';

export function matchMenuAction(text: string, locale: BotLocale): BotMenuAction | null {
  const btn = BOT_MENU_BTN[locale];
  if (text === btn.support) return 'support';
  if (text === btn.channel) return 'channel';
  if (text === btn.premiumStatus) return 'status';
  if (text === btn.help) return 'help';
  return null;
}

/** Persistent reply keyboard (grid icon menu at the bottom). */
export function mainMenuReplyMarkup(locale: BotLocale) {
  const btn = BOT_MENU_BTN[locale];
  return {
    reply_markup: {
      keyboard: [
        [{ text: btn.openApp, web_app: { url: getAppHomeUrl() } }],
        [{ text: btn.support }, { text: btn.channel }],
        [{ text: btn.premiumStatus }, { text: btn.help }],
      ],
      resize_keyboard: true,
      is_persistent: true,
    },
  };
}

export function withMainMenu(
  locale: BotLocale,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { ...extra, ...mainMenuReplyMarkup(locale) };
}

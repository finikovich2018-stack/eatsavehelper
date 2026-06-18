type BotLocale = 'ru' | 'en';

export function botLocale(languageCode?: string): BotLocale {
  if (languageCode?.startsWith('en')) return 'en';
  return 'ru';
}

const MESSAGES = {
  ru: {
    start: (name: string) =>
      `Привет, ${name}! 👋\n\nЯ EatSave — умный холодильник и бюджет на продукты. Откройте приложение, чтобы отслеживать сроки годности и получать напоминания.`,
    premiumActivated:
      '⭐ Premium активирован на 30 дней! Спасибо за поддержку EatSave.',
    premiumFailed:
      '⚠️ Оплата получена, но активация Premium не удалась. Нажмите «Активировать Premium» в профиле приложения.',
    subscribed: '✅ Уведомления включены. Буду напоминать о продуктах, которые скоро испортятся.',
    unsubscribed: '🔕 Уведомления отключены.',
    status: (premium: boolean, notifications: boolean) =>
      `📊 Статус EatSave\n\nPremium: ${premium ? '✅ активен' : '❌ нет'}\nУведомления: ${notifications ? '✅ вкл' : '🔕 выкл'}`,
    activateOk: '✅ Premium активирован! Откройте приложение.',
    activateFail: '❌ Не найдена недавняя оплата Stars. Оплатите Premium в приложении или напишите в поддержку.',
    expiryReminder: (name: string, items: string) =>
      `Привет, ${name}! Завтра истекает срок годности:\n\n${items}`,
    openApp: '📱 Открыть EatSave',
  },
  en: {
    start: (name: string) =>
      `Hi, ${name}! 👋\n\nI'm EatSave — smart fridge & grocery budget. Open the app to track expiry dates and get reminders.`,
    premiumActivated:
      '⭐ Premium activated for 30 days! Thank you for supporting EatSave.',
    premiumFailed:
      '⚠️ Payment received but Premium activation failed. Tap «Activate Premium» in the app profile.',
    subscribed: '✅ Notifications enabled. I will remind you about expiring products.',
    unsubscribed: '🔕 Notifications disabled.',
    status: (premium: boolean, notifications: boolean) =>
      `📊 EatSave status\n\nPremium: ${premium ? '✅ active' : '❌ none'}\nNotifications: ${notifications ? '✅ on' : '🔕 off'}`,
    activateOk: '✅ Premium activated! Open the app.',
    activateFail: '❌ No recent Stars payment found. Pay for Premium in the app or contact support.',
    expiryReminder: (name: string, items: string) =>
      `Hi, ${name}! These items expire tomorrow:\n\n${items}`,
    openApp: '📱 Open EatSave',
  },
} as const;

export function botMsg(locale: BotLocale) {
  return MESSAGES[locale];
}

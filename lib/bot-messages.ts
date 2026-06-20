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
    premiumGranted: (days: number, until: string, extended?: boolean) =>
      extended
        ? `🎁 Premium продлён на ${days} дн.!\n\nАктивен до ${until}. Приятного пользования EatSave!`
        : `🎁 Вам подарили Premium на ${days} дн.!\n\nАктивен до ${until}. Приятного пользования EatSave!`,
    premiumFailed:
      '⚠️ Оплата получена, но активация Premium не удалась. Нажмите «Активировать Premium» в профиле приложения.',
    subscribed: '✅ Уведомления включены. Буду напоминать о продуктах, которые скоро испортятся.',
    unsubscribed: '🔕 Уведомления отключены.',
    status: (premium: boolean, notifications: boolean) =>
      `📊 Статус EatSave\n\nPremium: ${premium ? '✅ активен' : '❌ нет'}\nУведомления: ${notifications ? '✅ вкл' : '🔕 выкл'}`,
    activateOk: '✅ Premium активирован! Откройте приложение.',
    activateFail: '❌ Не найдена недавняя оплата Stars. Оплатите Premium в приложении или напишите в поддержку.',
    help:
      '📖 Команды:\n/start — приложение\n/status — Premium\n/subscribe — напоминания\n/feedback — отзывы\n\n💬 Вопросы и отзывы о приложении — в нашем канале:',
    feedbackChannel:
      'Спасибо за сообщение! 💬\n\nОтзывы, идеи и вопросы о EatSave пишите в канале — там можно оставить комментарий и обсудить приложение с другими.\n\nhttps://t.me/EatSavehelper',
    openChannel: '💬 Канал EatSave',
    expiryReminder: (name: string, items: string) =>
      `Привет, ${name}! Завтра истекает срок годности:\n\n${items}`,
    openApp: '📱 Открыть EatSave',
    familyInviteOpen:
      '👨‍👩‍👧 Вас пригласили в семью EatSave!\n\nОткройте приложение — общий холодильник, бюджет и список покупок.',
    referralInviteOpen:
      '🎁 Вас пригласили в EatSave!\n\nОткройте приложение — друг получит +3 дня Premium, когда вы начнёте пользоваться.',
    referralReward: (days: number, until: string) =>
      `🎉 По вашей ссылке пришёл новый друг!\n\n+${days} дня Premium${until ? ` — активен до ${until}` : ''}. Спасибо, что делитесь EatSave!`,
  },
  en: {
    start: (name: string) =>
      `Hi, ${name}! 👋\n\nI'm EatSave — smart fridge & grocery budget. Open the app to track expiry dates and get reminders.`,
    premiumActivated:
      '⭐ Premium activated for 30 days! Thank you for supporting EatSave.',
    premiumGranted: (days: number, until: string, extended?: boolean) =>
      extended
        ? `🎁 Premium extended by ${days} days!\n\nActive until ${until}. Enjoy EatSave!`
        : `🎁 You received Premium for ${days} days!\n\nActive until ${until}. Enjoy EatSave!`,
    premiumFailed:
      '⚠️ Payment received but Premium activation failed. Tap «Activate Premium» in the app profile.',
    subscribed: '✅ Notifications enabled. I will remind you about expiring products.',
    unsubscribed: '🔕 Notifications disabled.',
    status: (premium: boolean, notifications: boolean) =>
      `📊 EatSave status\n\nPremium: ${premium ? '✅ active' : '❌ none'}\nNotifications: ${notifications ? '✅ on' : '🔕 off'}`,
    activateOk: '✅ Premium activated! Open the app.',
    activateFail: '❌ No recent Stars payment found. Pay for Premium in the app or contact support.',
    help:
      '📖 Commands:\n/start — open app\n/status — Premium\n/subscribe — reminders\n/feedback — feedback\n\n💬 Questions and feedback — in our channel:',
    feedbackChannel:
      'Thanks for your message! 💬\n\nShare feedback, ideas, and questions about EatSave in our channel — leave a comment and discuss the app with others.\n\nhttps://t.me/EatSavehelper',
    openChannel: '💬 EatSave channel',
    expiryReminder: (name: string, items: string) =>
      `Hi, ${name}! These items expire tomorrow:\n\n${items}`,
    openApp: '📱 Open EatSave',
    familyInviteOpen:
      '👨‍👩‍👧 You were invited to an EatSave family!\n\nOpen the app for a shared fridge, budget and shopping list.',
    referralInviteOpen:
      '🎁 You were invited to EatSave!\n\nOpen the app — your friend gets +3 days Premium when you start using it.',
    referralReward: (days: number, until: string) =>
      `🎉 A new friend joined via your link!\n\n+${days} days Premium${until ? ` — active until ${until}` : ''}. Thanks for sharing EatSave!`,
  },
} as const;

export function botMsg(locale: BotLocale) {
  return MESSAGES[locale];
}

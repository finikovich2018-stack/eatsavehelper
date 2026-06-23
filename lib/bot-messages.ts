import { greetingWithName } from '@/lib/greeting';

type BotLocale = 'ru' | 'en';

export function botLocale(languageCode?: string): BotLocale {
  if (languageCode?.startsWith('en')) return 'en';
  return 'ru';
}

const MESSAGES = {
  ru: {
    start: (name: string) =>
      `${greetingWithName(name, 'ru')} 👋\n\nЯ EatSave — умный холодильник и бюджет на продукты. Откройте приложение, чтобы отслеживать сроки годности и получать напоминания.`,
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
      '📖 Команды:\n/start — приложение\n/status — Premium\n/subscribe — напоминания\n/feedback — отзыв или вопрос\n\n💬 Отзывы — двумя способами (выберите кнопку ниже):',
    feedbackChoose:
      '💬 Куда написать отзыв или вопрос?\n\n✉️ <b>Бот</b> — лично разработчику (ответ придёт сюда)\n💬 <b>Канал</b> — комментарий под постом (видят другие)',
    feedbackWriteHere:
      '✉️ Напишите сообщение в этот чат — передам разработчику.\n\nМожно текст, скрин или фото.',
    feedbackReceived:
      '✅ Сообщение получено! Ответим здесь в боте.',
    adminFeedbackHint:
      'ℹ️ Вы админ — бот не пересылает ваши сообщения.\n\nЧтобы ответить пользователю: откройте его профиль в Telegram по @username или id из уведомления и напишите там напрямую.',
    feedbackNoAdmin:
      'Спасибо! Сейчас личная поддержка недоступна — оставьте комментарий в канале (кнопка ниже).',
    feedbackChannel:
      '💬 Комментарий в канале — нажмите кнопку ниже и напишите под постом.',
    openChannel: '💬 Комментарий в канале',
    writeToBot: '✉️ Написать боту',
    expiryReminder: (name: string, items: string) =>
      `${greetingWithName(name, 'ru')}\n\nЗавтра истекает срок годности:\n\n${items}`,
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
      `${greetingWithName(name, 'en')} 👋\n\nI'm EatSave — smart fridge & grocery budget. Open the app to track expiry dates and get reminders.`,
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
      '📖 Commands:\n/start — open app\n/status — Premium\n/subscribe — reminders\n/feedback — feedback or question\n\n💬 Two ways to reach us (pick a button):',
    feedbackChoose:
      '💬 Where should we read your feedback?\n\n✉️ <b>Bot</b> — private message to the developer (reply here)\n💬 <b>Channel</b> — comment under our post (public)',
    feedbackWriteHere:
      '✉️ Send your message in this chat — I will forward it to the developer.\n\nText, screenshot, or photo works.',
    feedbackReceived:
      '✅ Message received! We will reply here in the bot.',
    adminFeedbackHint:
      'ℹ️ You are an admin — the bot does not relay your messages.\n\nTo reply to a user: open their Telegram profile via @username or id from the notification and message them directly.',
    feedbackNoAdmin:
      'Thanks! Private support is unavailable right now — please leave a comment in the channel (button below).',
    feedbackChannel:
      '💬 Channel comment — tap the button below and write under the post.',
    openChannel: '💬 Comment in channel',
    writeToBot: '✉️ Message the bot',
    expiryReminder: (name: string, items: string) =>
      `${greetingWithName(name, 'en')}\n\nThese items expire tomorrow:\n\n${items}`,
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

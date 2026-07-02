import { greetingWithName } from '@/lib/greeting';

type BotLocale = 'ru' | 'en';

export function botLocale(languageCode?: string): BotLocale {
  if (languageCode?.startsWith('en')) return 'en';
  return 'ru';
}

function premiumDaysLeft(premiumUntil: string): number {
  return Math.max(0, Math.ceil((new Date(premiumUntil).getTime() - Date.now()) / 86400000));
}

function formatDaysLeft(n: number, locale: BotLocale): string {
  if (locale === 'en') return n === 1 ? '1 day' : `${n} days`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

function formatPremiumLine(premium: boolean, premiumUntil: string | null | undefined, locale: BotLocale): string {
  if (!premium) return locale === 'en' ? '❌ none' : '❌ нет';
  if (!premiumUntil) return locale === 'en' ? '✅ active' : '✅ активен';
  const days = premiumDaysLeft(premiumUntil);
  const left = formatDaysLeft(days, locale);
  return locale === 'en' ? `✅ active · ${left} left` : `✅ активен · осталось ${left}`;
}

const MESSAGES = {
  ru: {
    start: (name: string) =>
      `${greetingWithName(name, 'ru')} 👋\n\nЯ EatSave — умный холодильник и бюджет на продукты.\n\n📱 Откройте приложение или выберите кнопку меню внизу 👇`,
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
    status: (premium: boolean, notifications: boolean, premiumUntil?: string | null) =>
      `📊 Статус EatSave\n\nPremium: ${formatPremiumLine(premium, premiumUntil, 'ru')}\nУведомления: ${notifications ? '✅ вкл' : '🔕 выкл'}`,
    activateOk: '✅ Premium активирован! Откройте приложение.',
    activateFail: '❌ Не найдена недавняя оплата Stars. Оплатите Premium в приложении или напишите в поддержку.',
    help:
      '📖 Меню внизу 👇\n\n📱 Открыть EatSave — приложение\n✉️ Написать поддержку — личное сообщение\n💬 Комментарий в канале — отзыв под постом\n⭐ Купить Premium — оплата Stars в боте\n⭐ Статус Premium — подписка и уведомления\n❓ Помощь — эта подсказка\n\nКоманды: /start /status /subscribe /feedback',
    premiumInvoiceFailed: '❌ Не удалось выставить счёт. Попробуйте позже или купите Premium в приложении.',
    feedbackChoose:
      '💬 Отзыв или вопрос:\n\n✉️ <b>Написать поддержку</b> — лично разработчику (ответ в боте)\n💬 <b>Комментарий в канале</b> — публичный отзыв под постом\n\nКнопки меню внизу 👇',
    feedbackWriteHere:
      '✉️ Напишите сообщение в этот чат — передам разработчику.\n\nМожно текст, скрин или фото.',
    feedbackReceived:
      '✅ Сообщение получено! Ответим здесь в боте.',
    adminFeedbackHint:
      '💬 Как ответить пользователю:\n\n1️⃣ Нажмите «Ответить» на уведомление 📩 или пересланное сообщение и напишите текст\n\n2️⃣ Или команда:\n/reply 123456789 ваш текст\n\n(id — число из уведомления «· id …»)',
    adminReplySent: (userId: number) =>
      `✅ Ответ отправлен пользователю (id ${userId}).`,
    adminReplyFailed: (reason: string) => `❌ Не удалось отправить ответ: ${reason}`,
    userSupportReply: (text: string) => `💬 Ответ от поддержки EatSave:\n\n${text}`,
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
    referralMilestone: (days: number, until: string) =>
      `🏆 Веха достигнута! Вы пригласили ещё одну тройку друзей.\n\n+${days} дней Premium${until ? ` — активен до ${until}` : ''}. Продолжайте в том же духе!`,
    budgetAlert: (pct: number) =>
      `⚠️ Вы потратили ${pct}% месячного бюджета в EatSave. Планируйте покупки аккуратно, чтобы уложиться.`,
    budgetOver: () =>
      `🚨 Месячный бюджет превышен. Загляните в EatSave — посмотрите, на что уходят деньги.`,
  },
  en: {
    start: (name: string) =>
      `${greetingWithName(name, 'en')} 👋\n\nI'm EatSave — smart fridge & grocery budget.\n\n📱 Open the app or use the menu buttons below 👇`,
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
    status: (premium: boolean, notifications: boolean, premiumUntil?: string | null) =>
      `📊 EatSave status\n\nPremium: ${formatPremiumLine(premium, premiumUntil, 'en')}\nNotifications: ${notifications ? '✅ on' : '🔕 off'}`,
    activateOk: '✅ Premium activated! Open the app.',
    activateFail: '❌ No recent Stars payment found. Pay for Premium in the app or contact support.',
    help:
      '📖 Menu below 👇\n\n📱 Open EatSave — the app\n✉️ Contact support — private message\n💬 Channel comment — public feedback\n⭐ Buy Premium — pay with Stars in bot\n⭐ Premium status — subscription & notifications\n❓ Help — this guide\n\nCommands: /start /status /subscribe /feedback',
    premiumInvoiceFailed: '❌ Could not create invoice. Try again later or buy Premium in the app.',
    feedbackChoose:
      '💬 Feedback or question:\n\n✉️ <b>Contact support</b> — private message (reply in bot)\n💬 <b>Channel comment</b> — public comment under our post\n\nUse the menu buttons below 👇',
    feedbackWriteHere:
      '✉️ Send your message in this chat — I will forward it to the developer.\n\nText, screenshot, or photo works.',
    feedbackReceived:
      '✅ Message received! We will reply here in the bot.',
    adminFeedbackHint:
      '💬 How to reply to a user:\n\n1️⃣ Tap Reply on the 📩 notification or forwarded message and type your text\n\n2️⃣ Or use:\n/reply 123456789 your text\n\n(id is the number in «· id …» from the notification)',
    adminReplySent: (userId: number) => `✅ Reply sent to user (id ${userId}).`,
    adminReplyFailed: (reason: string) => `❌ Could not send reply: ${reason}`,
    userSupportReply: (text: string) => `💬 Reply from EatSave support:\n\n${text}`,
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
    referralMilestone: (days: number, until: string) =>
      `🏆 Milestone reached! You've invited another three friends.\n\n+${days} days Premium${until ? ` — active until ${until}` : ''}. Keep it up!`,
    budgetAlert: (pct: number) =>
      `⚠️ You've spent ${pct}% of your monthly EatSave budget. Plan your purchases carefully to stay on track.`,
    budgetOver: () =>
      `🚨 Monthly budget exceeded. Open EatSave to see where your money goes.`,
  },
} as const;

export function botMsg(locale: BotLocale) {
  return MESSAGES[locale];
}

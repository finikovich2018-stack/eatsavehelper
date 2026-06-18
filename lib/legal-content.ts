export type LegalSection = { heading: string; body: string };

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const CONTACT = '@EatSavehelper_bot';
const APP = 'EatSave';

export const privacyDocs: Record<'ru' | 'en', LegalDoc> = {
  ru: {
    title: 'Политика конфиденциальности',
    updated: '18 июня 2026',
    intro: `${APP} — Telegram Mini App для учёта продуктов, бюджета и рецептов. Мы обрабатываем только данные, нужные для работы сервиса.`,
    sections: [
      {
        heading: '1. Какие данные мы собираем',
        body:
          '• Telegram ID, имя и username (из Telegram)\n' +
          '• Продукты в холодильнике, сроки годности, цены\n' +
          '• Чеки, траты, бюджет по валютам\n' +
          '• Сохранённые рецепты и статистика использования (сканы, AI)\n' +
          '• Статус Premium и настройки уведомлений\n' +
          '• Фото чеков обрабатываются для распознавания и не хранятся как файлы (только извлечённые данные)',
      },
      {
        heading: '2. Зачем мы это делаем',
        body:
          'Данные нужны для: отображения холодильника и бюджета, AI-рецептов, напоминаний о сроках годности, Premium-подписки и улучшения сервиса.',
      },
      {
        heading: '3. Где хранятся данные',
        body:
          '• База данных: Supabase (EU/US — регион вашего проекта Supabase)\n' +
          '• Приложение и API: Vercel\n' +
          '• AI-распознавание чеков и рецептов: Anthropic Claude\n' +
          '• Платежи Premium: Telegram Stars (обрабатывает Telegram)',
      },
      {
        heading: '4. Кому передаются данные',
        body:
          'Мы не продаём ваши данные. Передача только перечисленным провайдерам для работы приложения и только в объёме, необходимом для сервиса.',
      },
      {
        heading: '5. Срок хранения',
        body:
          'Данные хранятся, пока вы пользуетесь приложением. Вы можете удалить продукты, траты и рецепты в приложении. Полное удаление аккаунта — по запросу в бот.',
      },
      {
        heading: '6. Ваши права (GDPR)',
        body:
          'Вы можете запросить доступ, исправление или удаление данных, написав в ' +
          CONTACT +
          '. Мы ответим в разумный срок (до 30 дней).',
      },
      {
        heading: '7. Безопасность',
        body:
          'Доступ к данным через защищённое API с проверкой Telegram initData. Прямой доступ к базе с клиента закрыт (RLS).',
      },
      {
        heading: '8. Контакты',
        body: `По вопросам конфиденциальности: ${CONTACT} в Telegram.`,
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: '18 June 2026',
    intro: `${APP} is a Telegram Mini App for fridge inventory, grocery budget, and AI recipes. We only process data required to run the service.`,
    sections: [
      {
        heading: '1. Data we collect',
        body:
          '• Telegram ID, name, and username (from Telegram)\n' +
          '• Fridge items, expiry dates, prices\n' +
          '• Receipts, expenses, multi-currency budgets\n' +
          '• Saved recipes and usage stats (scans, AI recipes)\n' +
          '• Premium status and notification preferences\n' +
          '• Receipt photos are processed for OCR; we store extracted data, not image files',
      },
      {
        heading: '2. Why we use it',
        body:
          'To show your fridge and budget, suggest AI recipes, send expiry reminders, manage Premium, and improve the app.',
      },
      {
        heading: '3. Where data is stored',
        body:
          '• Database: Supabase (region of your Supabase project)\n' +
          '• App & API: Vercel\n' +
          '• AI (receipts & recipes): Anthropic Claude\n' +
          '• Premium payments: Telegram Stars (processed by Telegram)',
      },
      {
        heading: '4. Sharing',
        body:
          'We do not sell your data. We share data only with the providers above, as needed to operate the service.',
      },
      {
        heading: '5. Retention',
        body:
          'Data is kept while you use the app. You can delete items in the app. Full account deletion — request via the bot.',
      },
      {
        heading: '6. Your rights (GDPR)',
        body:
          'You may request access, correction, or deletion by contacting ' +
          CONTACT +
          '. We respond within a reasonable time (up to 30 days).',
      },
      {
        heading: '7. Security',
        body:
          'Data access goes through authenticated API (Telegram initData). Direct client database access is blocked (RLS).',
      },
      {
        heading: '8. Contact',
        body: `Privacy questions: ${CONTACT} on Telegram.`,
      },
    ],
  },
};

export const termsDocs: Record<'ru' | 'en', LegalDoc> = {
  ru: {
    title: 'Условия использования',
    updated: '18 июня 2026',
    intro: `Используя ${APP} (@EatSavehelper_bot), вы соглашаетесь с этими условиями.`,
    sections: [
      {
        heading: '1. Сервис',
        body:
          `${APP} помогает вести холодильник, бюджет на продукты, сканировать чеки и получать AI-рецепты. Сервис предоставляется «как есть».`,
      },
      {
        heading: '2. Аккаунт',
        body:
          'Доступ через Telegram. Вы отвечаете за безопасность своего аккаунта Telegram. Один пользователь — один аккаунт.',
      },
      {
        heading: '3. Бесплатный план и Premium',
        body:
          'Бесплатно: до 30 продуктов, 3 скана и 3 AI-рецепта в месяц.\n' +
          'Premium: 100 Telegram Stars / 30 дней — безлимитные функции.\n' +
          'Оплата через Telegram Stars. Подписка не продлевается автоматически без повторной оплаты.',
      },
      {
        heading: '4. Возвраты',
        body:
          'Цифровая подписка через Telegram Stars. Возврат возможен только по правилам Telegram и при технической ошибке с нашей стороны — пишите в ' +
          CONTACT +
          '.',
      },
      {
        heading: '5. AI и точность',
        body:
          'AI может ошибаться при распознавании чеков и рецептах. Проверяйте сроки годности и состав продуктов самостоятельно. Мы не несём ответственности за решения о питании или покупках.',
      },
      {
        heading: '6. Запрещено',
        body:
          'Взлом, спам, автоматический сбор данных, обход лимитов, загрузка незаконного контента.',
      },
      {
        heading: '7. Изменения',
        body:
          'Мы можем обновлять приложение и условия. Актуальная версия — в Mini App. Продолжение использования означает согласие.',
      },
      {
        heading: '8. Контакты',
        body: `Поддержка и вопросы: ${CONTACT} в Telegram.`,
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: '18 June 2026',
    intro: `By using ${APP} (@EatSavehelper_bot), you agree to these terms.`,
    sections: [
      {
        heading: '1. Service',
        body:
          `${APP} helps manage your fridge, grocery budget, receipt scanning, and AI recipes. The service is provided "as is".`,
      },
      {
        heading: '2. Account',
        body:
          'Access is via Telegram. You are responsible for your Telegram account security. One user — one account.',
      },
      {
        heading: '3. Free & Premium',
        body:
          'Free: up to 30 fridge items, 3 scans and 3 AI recipes per month.\n' +
          'Premium: 100 Telegram Stars / 30 days — unlimited features.\n' +
          'Payment via Telegram Stars. No auto-renewal without a new payment.',
      },
      {
        heading: '4. Refunds',
        body:
          'Digital subscription via Telegram Stars. Refunds follow Telegram policies; contact ' +
          CONTACT +
          ' for technical issues on our side.',
      },
      {
        heading: '5. AI disclaimer',
        body:
          'AI may misread receipts or suggest incorrect recipes. Always verify expiry dates and ingredients. We are not liable for dietary or purchasing decisions.',
      },
      {
        heading: '6. Prohibited use',
        body:
          'No hacking, spam, scraping, limit evasion, or illegal content.',
      },
      {
        heading: '7. Changes',
        body:
          'We may update the app and terms. The current version is in the Mini App. Continued use means acceptance.',
      },
      {
        heading: '8. Contact',
        body: `Support: ${CONTACT} on Telegram.`,
      },
    ],
  },
};

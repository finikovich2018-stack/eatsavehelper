/** Menu button left of the message field — default (no duplicate Open App button). */
export function buildChatMenuButton() {
  return {
    menu_button: {
      type: 'default' as const,
    },
  };
}

export const BOT_TELEGRAM_COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'status', description: 'Premium и уведомления' },
  { command: 'subscribe', description: 'Включить напоминания' },
  { command: 'unsubscribe', description: 'Выключить напоминания' },
  { command: 'activate', description: 'Активировать Premium после оплаты' },
  { command: 'feedback', description: 'Отзыв: бот или комментарий в канале' },
  { command: 'help', description: 'Команды и связь с поддержкой' },
];

export async function applyBotTelegramUi(botToken: string) {
  const menuRes = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildChatMenuButton()),
  });
  const menuData = await menuRes.json();

  const commandsRes = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: BOT_TELEGRAM_COMMANDS }),
  });
  const commandsData = await commandsRes.json();

  return {
    menuOk: menuData.ok,
    menuError: menuData.ok ? undefined : menuData.description,
    commandsOk: commandsData.ok,
    commandsError: commandsData.ok ? undefined : commandsData.description,
  };
}

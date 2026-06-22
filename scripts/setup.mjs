/**
 * Local setup helper — reads .env.local and configures Telegram webhook + menu button.
 * Usage: node scripts/setup.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');

function loadEnv() {
  const env = {};
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    console.error('Не найден .env.local');
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const useLocal = process.argv.includes('--local');
const baseUrl = useLocal
  ? 'http://localhost:3000'
  : (env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
      .replace(/\/$/, '')
      .replace(/\/home$/, '');

async function checkConfig() {
  const res = await fetch(`${baseUrl}/api/setup`);
  const data = await res.json();
  console.log('\n📋 Статус конфигурации:\n');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

function isValidBotToken(token) {
  return /^\d+:[A-Za-z0-9_-]+$/.test(token.trim());
}

function validateBotToken(token) {
  const trimmed = (token || '').trim();
  if (!trimmed) {
    console.error('❌ TELEGRAM_BOT_TOKEN не задан в .env.local');
    process.exit(1);
  }
  if (!isValidBotToken(trimmed)) {
    console.error('❌ TELEGRAM_BOT_TOKEN имеет неверный формат.');
    console.error('   Нужен полный токен от @BotFather: 123456789:ABCdef...');
    console.error('   Сейчас указана только часть токена (без ID бота и двоеточия).');
    console.error('   @BotFather → ваш бот → /token');
    process.exit(1);
  }
  return trimmed;
}

async function runDirectSetup() {
  const botToken = validateBotToken(env.TELEGRAM_BOT_TOKEN);
  const prodUrl = (env.NEXT_PUBLIC_APP_URL || '')
    .replace(/\/$/, '')
    .replace(/\/home$/, '');

  if (!prodUrl) {
    console.error('❌ NEXT_PUBLIC_APP_URL не задан');
    process.exit(1);
  }

  const webhookUrl = `${prodUrl}/api/bot`;
  const secret = env.TELEGRAM_WEBHOOK_SECRET;

  const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const meData = await meRes.json();
  if (!meData.ok) {
    console.error('❌ Telegram getMe:', meData.description);
    console.error('   Получите новый токен: @BotFather → /token');
    process.exit(1);
  }

  console.log(`\n🤖 Бот: @${meData.result.username}`);

  const webhookPayload = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    drop_pending_updates: true,
  };
  if (secret) webhookPayload.secret_token = secret;

  const webhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });
  const webhookData = await webhookRes.json();

  if (!webhookData.ok) {
    console.error('❌ setWebhook:', webhookData.description);
    process.exit(1);
  }

  const menuRes = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Открыть EatSave',
        web_app: { url: `${prodUrl}/home` },
      },
    }),
  });
  const menuData = await menuRes.json();

  await fetch(`https://api.telegram.org/bot${botToken}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description:
        'EatSave — умный холодильник в Telegram. Скан чеков, AI-рецепты, бюджет, напоминания о сроках годности. Premium ⭐ 100 Stars/мес.',
    }),
  });

  await fetch(`https://api.telegram.org/bot${botToken}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_description: 'Умный холодильник + бюджет. Скан чеков, AI-рецепты.',
    }),
  });

  await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Открыть EatSave' },
        { command: 'status', description: 'Premium и уведомления' },
        { command: 'subscribe', description: 'Включить напоминания' },
        { command: 'unsubscribe', description: 'Выключить напоминания' },
        { command: 'activate', description: 'Активировать Premium после оплаты' },
        { command: 'feedback', description: 'Отзыв: бот или комментарий в канале' },
        { command: 'help', description: 'Команды и связь с поддержкой' },
      ],
    }),
  });

  console.log('\n✅ Telegram настроен (локально через Bot API):\n');
  console.log(JSON.stringify({
    ok: true,
    bot: meData.result.username,
    webhookUrl,
    menuButton: menuData.ok,
    menuError: menuData.ok ? undefined : menuData.description,
  }, null, 2));

  console.log('\n⚠️  Скопируйте тот же TELEGRAM_BOT_TOKEN в Vercel → Environment Variables');
  console.log('   и сделайте Redeploy, иначе бот на сервере не сможет отвечать.');
}

async function runSetup() {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    console.error('❌ CRON_SECRET не задан в .env.local');
    process.exit(1);
  }

  const prodUrl = (env.NEXT_PUBLIC_APP_URL || '')
    .replace(/\/$/, '')
    .replace(/\/home$/, '');

  if (!prodUrl) {
    console.error('❌ NEXT_PUBLIC_APP_URL не задан');
    process.exit(1);
  }

  const res = await fetch(`${prodUrl}/api/setup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        console.error('❌ Unauthorized: CRON_SECRET в .env.local не совпадает с Vercel.');
        console.error('   Скопируйте CRON_SECRET из Vercel → Environment Variables');
        console.error('   и вставьте в .env.local, затем повторите команду.');
      } else {
        console.error('❌ Ошибка setup:', data);
        if (data.hint) console.error('💡', data.hint);
      }
      process.exit(1);
    }

  console.log('\n✅ Telegram настроен:\n');
  console.log(JSON.stringify(data, null, 2));
}

console.log(`🌐 App URL: ${baseUrl}`);

await checkConfig();

if (process.argv.includes('--apply')) {
  if (process.argv.includes('--direct')) {
    await runDirectSetup();
  } else {
    await runSetup();
  }
} else {
  console.log('\n💡 Чтобы применить webhook и кнопку меню, запустите:');
  console.log('   node scripts/setup.mjs --apply          # через Vercel API');
  console.log('   node scripts/setup.mjs --apply --direct # напрямую через Bot API');
}

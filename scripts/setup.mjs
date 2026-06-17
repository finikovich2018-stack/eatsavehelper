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
  await runSetup();
} else {
  console.log('\n💡 Чтобы применить webhook и кнопку меню, запустите:');
  console.log('   node scripts/setup.mjs --apply');
}

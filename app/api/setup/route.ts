import { NextRequest, NextResponse } from 'next/server';
import { getAppBaseUrl, getAppHomeUrl } from '@/lib/app-url';
import { getBotToken, isBotTokenConfigured } from '@/lib/bot-token';
import { checkPremiumDb } from '@/lib/premium';
import { getAdminTelegramIds } from '@/lib/admin';

export const dynamic = 'force-dynamic';

function isConfigured(value?: string) {
  return Boolean(value && value.trim() && !value.includes('placeholder'));
}

/** GET — check which env vars are set (no secrets exposed). */
export async function GET() {
  const appUrl = getAppBaseUrl();
  const premiumDb = await checkPremiumDb();

  return NextResponse.json({
    ok: true,
    config: {
      supabaseUrl: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseServiceKey: isConfigured(process.env.SUPABASE_SERVICE_ROLE_KEY),
      premiumDb: premiumDb.ok,
      telegramBot: isBotTokenConfigured(),
      webhookSecret: isConfigured(process.env.TELEGRAM_WEBHOOK_SECRET),
      anthropicKey: isConfigured(process.env.ANTHROPIC_API_KEY),
      workerUrl: isConfigured(process.env.NEXT_PUBLIC_WORKER_URL),
      cronSecret: isConfigured(process.env.CRON_SECRET),
      adminTelegramIds: getAdminTelegramIds().length > 0,
      adminTelegramIdsCount: getAdminTelegramIds().length,
      appUrl: Boolean(appUrl),
    },
    urls: {
      app: appUrl || null,
      home: appUrl ? getAppHomeUrl() : null,
      webhook: appUrl ? `${appUrl}/api/bot` : null,
    },
    premiumDbError: premiumDb.ok ? undefined : premiumDb.error,
    nextSteps: [
      !isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) && 'Добавьте NEXT_PUBLIC_SUPABASE_URL в .env.local и Vercel',
      !isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && 'Добавьте NEXT_PUBLIC_SUPABASE_ANON_KEY',
      !isConfigured(process.env.SUPABASE_SERVICE_ROLE_KEY) && 'Добавьте SUPABASE_SERVICE_ROLE_KEY (service_role JWT из Supabase → Settings → API)',
      !isConfigured(process.env.ANTHROPIC_API_KEY) && !isConfigured(process.env.NEXT_PUBLIC_WORKER_URL) && 'Добавьте ANTHROPIC_API_KEY или NEXT_PUBLIC_WORKER_URL для AI',
      !isConfigured(process.env.CRON_SECRET) && 'Добавьте CRON_SECRET для cron-уведомлений',
      'Примените supabase/setup.sql в Supabase SQL Editor',
      'Примените supabase/patch_rls.sql (блокировка anon-доступа)',
      'Примените supabase/patch_users_columns.sql (имена в admin)',
      !premiumDb.ok && 'Выполните supabase/patch_premium.sql — без этого Premium не активируется',
      getAdminTelegramIds().length === 0 && 'Добавьте ADMIN_TELEGRAM_IDS в Vercel для /admin',
      'POST /api/setup с заголовком Authorization: Bearer <CRON_SECRET> для webhook + menu button',
    ].filter(Boolean),
  });
}

/** POST — register Telegram webhook + Mini App menu button. Requires CRON_SECRET. */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken = getBotToken();
  const appUrl = getAppBaseUrl();

  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN не настроен' }, { status: 500 });
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL не настроен (без /home в конце)' },
      { status: 400 }
    );
  }

  const webhookUrl = `${appUrl}/api/bot`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const webhookPayload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
    drop_pending_updates: true,
  };

  if (secret) {
    webhookPayload.secret_token = secret;
  }

  const webhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookPayload),
  });
  const webhookData = await webhookRes.json();

  if (!webhookData.ok) {
    const hint =
      webhookData.description === 'Not Found'
        ? 'Проверьте TELEGRAM_BOT_TOKEN в Vercel — токен от @BotFather, формат 123456:ABC...'
        : undefined;
    return NextResponse.json(
      { error: webhookData.description, hint, telegram: webhookData },
      { status: 400 }
    );
  }

  const menuRes = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Открыть EatSave',
        web_app: { url: getAppHomeUrl() },
      },
    }),
  });
  const menuData = await menuRes.json();

  const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const meData = await meRes.json();

  return NextResponse.json({
    ok: true,
    bot: meData.ok ? meData.result.username : null,
    webhookUrl,
    menuButton: menuData.ok,
    menuError: menuData.ok ? undefined : menuData.description,
    adminIdsConfigured: getAdminTelegramIds().length,
    feedbackRelayReady: getAdminTelegramIds().length > 0,
  });
}

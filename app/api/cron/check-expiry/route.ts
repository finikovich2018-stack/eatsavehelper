import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppBaseUrl, getAppHomeUrl, getAppShoppingUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';
import {
  buildFoodReminderMessage,
  fetchExpiringInventory,
  fetchFoodReminders,
  reminderAppPath,
  reminderPreview,
  type ReminderUser,
} from '@/lib/food-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

async function sendMessage(
  chatId: number,
  text: string,
  appUrl = getAppHomeUrl(),
  cookUrl?: string
) {
  const botToken = getBotToken();
  if (!botToken) return false;

  const inlineKeyboard: { text: string; web_app: { url: string } }[][] = [];
  if (cookUrl) {
    inlineKeyboard.push([{ text: '🍳 Что приготовить', web_app: { url: cookUrl } }]);
  }
  inlineKeyboard.push([{ text: '📱 Открыть EatSave', web_app: { url: appUrl } }]);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard },
    }),
  });

  return res.ok;
}

function reminderAppUrl(user: ReminderUser): string {
  return reminderAppPath(user) === '/shopping' ? getAppShoppingUrl() : getAppHomeUrl();
}

/** Deep link that opens Recipes and auto-generates from soon-to-expire items. */
function cookRecipeUrl(user: ReminderUser): string | undefined {
  const hasFood = user.expiringSoon.length > 0 || user.expired.length > 0;
  return hasFood ? `${getAppBaseUrl()}/recipes?cook=expiring` : undefined;
}

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getBotToken()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const dryRun = new URL(req.url).searchParams.get('dry_run') === '1';
  const [{ users, maxDays, rpcErrors }, inventory] = await Promise.all([
    fetchFoodReminders(supabase),
    dryRun ? fetchExpiringInventory(supabase) : Promise.resolve(null),
  ]);

  if (rpcErrors.length > 0 && users.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Database functions missing or failed',
        rpc_errors: rpcErrors,
        hint: 'Run supabase/patch_food_reminders.sql and patch_notify_types_hourly.sql in Supabase SQL Editor',
      },
      { status: 500 }
    );
  }

  const preview = users.map(reminderPreview);

  if (users.length === 0) {
    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      message: 'Nothing to remind today',
      max_days: maxDays,
      users_notified: 0,
      preview: [],
      inventory_preview: inventory?.items,
      rpc_errors: rpcErrors.length ? rpcErrors : undefined,
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      max_days: maxDays,
      would_notify: preview.length,
      preview,
      rpc_errors: rpcErrors.length ? rpcErrors : undefined,
      sample_message: buildFoodReminderMessage(users[0]),
      inventory_preview: inventory?.items,
    });
  }

  let sent = 0;
  const notifiedIds: number[] = [];
  for (const user of users) {
    const text = buildFoodReminderMessage(user);
    if (!text) continue;
    const ok = await sendMessage(user.chat_id, text, reminderAppUrl(user), cookRecipeUrl(user));
    if (ok) {
      sent++;
      notifiedIds.push(user.telegram_user_id);
    }
  }

  // Guard against duplicate sends within the same local day (safe if the
  // endpoint is triggered more than once per hour by different schedulers).
  if (notifiedIds.length > 0) {
    const { error: markError } = await supabase.rpc('mark_reminded', {
      user_ids: notifiedIds,
    });
    if (markError) {
      console.error('mark_reminded error:', markError.message);
    }
  }

  return NextResponse.json({
    ok: true,
    max_days: maxDays,
    users_notified: sent,
    users_with_reminders: users.length,
    rpc_errors: rpcErrors.length ? rpcErrors : undefined,
  });
}

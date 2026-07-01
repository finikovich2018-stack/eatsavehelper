import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppHomeUrl } from '@/lib/app-url';
import { getBotToken } from '@/lib/bot-token';
import {
  buildWeeklyDigestMessage,
  sumByCurrency,
  type DigestStats,
  type DigestUser,
} from '@/lib/weekly-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function sendMessage(chatId: number, text: string) {
  const botToken = getBotToken();
  if (!botToken) return false;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '📱 Открыть EatSave', web_app: { url: getAppHomeUrl() } }]],
      },
    }),
  });

  return res.ok;
}

/** Aggregate fridge_log + expenses for a set of users over the past 7 days. */
async function collectStats(
  supabase: SupabaseClient,
  userIds: number[]
): Promise<Map<number, DigestStats>> {
  const stats = new Map<number, DigestStats>();
  for (const id of userIds) {
    stats.set(id, { eaten: 0, wasted: 0, wastedMoney: [], spent: [] });
  }

  const sinceIso = new Date(Date.now() - 7 * 86400000).toISOString();
  const sinceDate = sinceIso.split('T')[0];

  // Fridge activity (eaten / wasted / money thrown away).
  type LogRow = {
    telegram_user_id: number;
    action: string;
    price: number | null;
    currency: string | null;
  };
  let logRows: LogRow[] = [];
  const logPrimary = await supabase
    .from('fridge_log')
    .select('telegram_user_id, action, price, currency')
    .in('telegram_user_id', userIds)
    .gte('logged_at', sinceIso);
  if (logPrimary.error && /price|currency/i.test(logPrimary.error.message)) {
    const fallback = await supabase
      .from('fridge_log')
      .select('telegram_user_id, action')
      .in('telegram_user_id', userIds)
      .gte('logged_at', sinceIso);
    logRows = (fallback.data || []).map((r) => ({
      telegram_user_id: (r as { telegram_user_id: number }).telegram_user_id,
      action: (r as { action: string }).action,
      price: null,
      currency: null,
    }));
  } else {
    logRows = (logPrimary.data || []) as unknown as LogRow[];
  }

  const wastedByUser = new Map<number, { currency: string | null; amount: number }[]>();
  for (const r of logRows) {
    const s = stats.get(r.telegram_user_id);
    if (!s) continue;
    if (r.action === 'eaten') s.eaten += 1;
    if (r.action === 'wasted') {
      s.wasted += 1;
      const amt = Number(r.price) || 0;
      if (amt > 0) {
        const arr = wastedByUser.get(r.telegram_user_id) || [];
        arr.push({ currency: r.currency, amount: amt });
        wastedByUser.set(r.telegram_user_id, arr);
      }
    }
  }
  Array.from(wastedByUser.entries()).forEach(([id, rows]) => {
    const s = stats.get(id);
    if (s) s.wastedMoney = sumByCurrency(rows);
  });

  // Spending (expenses over the past week).
  const expenses = await supabase
    .from('expenses')
    .select('telegram_user_id, amount, currency')
    .in('telegram_user_id', userIds)
    .gte('date', sinceDate);
  const spentByUser = new Map<number, { currency: string | null; amount: number }[]>();
  for (const r of (expenses.data || []) as {
    telegram_user_id: number;
    amount: number;
    currency: string | null;
  }[]) {
    const arr = spentByUser.get(r.telegram_user_id) || [];
    arr.push({ currency: r.currency, amount: Number(r.amount) || 0 });
    spentByUser.set(r.telegram_user_id, arr);
  }
  Array.from(spentByUser.entries()).forEach(([id, rows]) => {
    const s = stats.get(id);
    if (s) s.spent = sumByCurrency(rows);
  });

  return stats;
}

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!getBotToken()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === '1';
  const previewUser = url.searchParams.get('preview_user');

  // Preview mode: build the message for one user ignoring the weekly schedule.
  if (previewUser) {
    const { data: u } = await supabase
      .from('users')
      .select('telegram_user_id, first_name, telegram_chat_id')
      .eq('telegram_user_id', Number(previewUser))
      .maybeSingle();
    if (!u) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    const user: DigestUser = {
      telegram_user_id: u.telegram_user_id,
      first_name: u.first_name,
      chat_id: u.telegram_chat_id,
    };
    const statsMap = await collectStats(supabase, [user.telegram_user_id]);
    const stats = statsMap.get(user.telegram_user_id)!;
    return NextResponse.json({
      ok: true,
      preview: true,
      stats,
      message: buildWeeklyDigestMessage(user, stats) || '(no activity — message skipped)',
    });
  }

  const { data: dueRows, error } = await supabase.rpc('get_weekly_digest_users');
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: 'Run supabase/patch_weekly_digest.sql in Supabase SQL Editor',
      },
      { status: 500 }
    );
  }

  const users: DigestUser[] = ((dueRows || []) as {
    user_telegram_id: number;
    first_name: string | null;
    chat_id: number;
  }[])
    .filter((r) => r.chat_id)
    .map((r) => ({
      telegram_user_id: r.user_telegram_id,
      first_name: r.first_name,
      chat_id: r.chat_id,
    }));

  if (users.length === 0) {
    return NextResponse.json({ ok: true, dry_run: dryRun, users_notified: 0, message: 'No digests due now' });
  }

  const statsMap = await collectStats(supabase, users.map((u) => u.telegram_user_id));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      due_users: users.length,
      preview: users.map((u) => ({
        telegram_user_id: u.telegram_user_id,
        stats: statsMap.get(u.telegram_user_id),
        message: buildWeeklyDigestMessage(u, statsMap.get(u.telegram_user_id)!),
      })),
    });
  }

  let sent = 0;
  const digestedIds: number[] = [];
  for (const user of users) {
    const stats = statsMap.get(user.telegram_user_id);
    if (!stats) continue;
    const text = buildWeeklyDigestMessage(user, stats);
    // Mark even skipped (idle) users so we don't recheck them every hour today.
    if (!text) {
      digestedIds.push(user.telegram_user_id);
      continue;
    }
    const ok = await sendMessage(user.chat_id, text);
    if (ok) {
      sent++;
      digestedIds.push(user.telegram_user_id);
    }
  }

  if (digestedIds.length > 0) {
    const { error: markError } = await supabase.rpc('mark_digest_sent', { user_ids: digestedIds });
    if (markError) console.error('mark_digest_sent error:', markError.message);
  }

  return NextResponse.json({ ok: true, users_notified: sent, due_users: users.length });
}

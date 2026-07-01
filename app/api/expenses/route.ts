import { NextRequest, NextResponse } from 'next/server';
import { botMsg } from '@/lib/bot-messages';
import { applyDataScope, resolveDataScope, scopedInsert, type DataScope } from '@/lib/data-scope';
import { sendBotMessage } from '@/lib/send-bot-message';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BUDGET_LIMITS: Record<string, number> = {
  RUB: 15000, USD: 500, EUR: 500, GBP: 400, UAH: 20000, KZT: 200000,
};

/**
 * Best-effort budget alert: when monthly spend in a currency crosses 80% or
 * 100% of the limit, notify the user once per month/level via Telegram.
 * Silently no-ops if the tracking column is missing or the user has no chat.
 */
async function maybeSendBudgetAlert(
  supabase: SupabaseClient,
  scope: DataScope,
  userId: number,
  currency: string
) {
  try {
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);
    const monthStart = `${monthKey}-01`;

    const { data: user } = await supabase
      .from('users')
      .select('telegram_chat_id, notifications_enabled, budget_alert_state')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (!user?.telegram_chat_id || user.notifications_enabled === false) return;

    const { data: budgetRows } = await applyDataScope(
      supabase.from('budgets').select('amount, currency'),
      scope
    ).eq('month', monthStart);
    const budgetRow = (budgetRows || []).find((b) => b.currency === currency);
    const limit = Number(budgetRow?.amount ?? DEFAULT_BUDGET_LIMITS[currency] ?? 0);
    if (!limit) return;

    const { data: expenseRows } = await applyDataScope(
      supabase.from('expenses').select('amount, currency'),
      scope
    ).gte('date', monthStart);
    const spent = (expenseRows || [])
      .filter((e) => (e.currency || 'RUB') === currency)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const pct = (spent / limit) * 100;
    const level = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
    if (level === 0) return;

    const alreadyState = String(user.budget_alert_state || '');
    const desired = `${monthKey}:${level}`;
    // Skip if we already sent this exact level (or a higher one) this month.
    if (alreadyState === desired) return;
    if (level === 80 && alreadyState === `${monthKey}:100`) return;

    const msg = botMsg('ru');
    const text = level === 100 ? msg.budgetOver() : msg.budgetAlert(Math.round(pct));
    await sendBotMessage(user.telegram_chat_id, text, { buttonText: msg.openApp });

    await supabase
      .from('users')
      .update({ budget_alert_state: desired })
      .eq('telegram_user_id', userId);
  } catch {
    // Column may not exist yet, or messaging failed — never block expense saving.
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const userId = auth.userId;
    const { op } = body;
    const scope = await resolveDataScope(supabase, userId);

    if (op === 'list') {
      let query = applyDataScope(supabase.from('expenses').select('*'), scope).order(
        'date',
        { ascending: false }
      );

      if (body.monthStart) {
        query = query.gte('date', body.monthStart);
      }

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'insert') {
      const item = body.item as Record<string, unknown>;
      if (!item) return NextResponse.json({ error: 'Missing item' }, { status: 400 });
      const { data, error } = await scopedInsert(supabase, 'expenses', scope, [item]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const currency = String((item.currency as string) || 'RUB');
      await maybeSendBudgetAlert(supabase, scope, userId, currency);

      return NextResponse.json({ item: (data || [])[0] });
    }

    if (op === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const query = applyDataScope(supabase.from('expenses').delete().eq('id', id), scope);
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

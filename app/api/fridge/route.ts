import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope, scopedInsert } from '@/lib/data-scope';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { FREE_FRIDGE_ITEMS } from '@/lib/constants';
import { hasEffectivePremium } from '@/lib/household';
import { getUserWithLimits } from '@/lib/usage-limits';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      const query = applyDataScope(
        supabase.from('fridge_items').select('*'),
        scope
      );
      const { data, error } = await query.order('expiry_date', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'count') {
      const query = applyDataScope(
        supabase.from('fridge_items').select('*', { count: 'exact', head: true }),
        scope
      );
      const { count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count || 0 });
    }

    if (op === 'insert') {
      const items = body.items as Record<string, unknown>[];
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'No items' }, { status: 400 });
      }

      const user = await getUserWithLimits(supabase, userId);
      const premium = await hasEffectivePremium(supabase, userId);
      if (!user || !premium) {
        const { error: capError } = await supabase.rpc('assert_fridge_capacity', {
          p_household_id: scope.householdId ?? null,
          p_user_id: userId,
          p_add_count: items.length,
          p_limit: FREE_FRIDGE_ITEMS,
        });

        if (capError) {
          if (capError.message.includes('fridge_limit')) {
            return NextResponse.json(
              { error: 'Fridge limit reached', code: 'fridge_limit', limit: FREE_FRIDGE_ITEMS },
              { status: 429 }
            );
          }
          if (!capError.message.includes('does not exist')) {
            return NextResponse.json({ error: capError.message }, { status: 500 });
          }

          const countQuery = applyDataScope(
            supabase.from('fridge_items').select('*', { count: 'exact', head: true }),
            scope
          );
          const { count } = await countQuery;
          if ((count || 0) + items.length > FREE_FRIDGE_ITEMS) {
            return NextResponse.json(
              { error: 'Fridge limit reached', code: 'fridge_limit', limit: FREE_FRIDGE_ITEMS },
              { status: 429 }
            );
          }
        }
      }

      let { data, error } = await scopedInsert(supabase, 'fridge_items', scope, items);
      // Gracefully degrade if the optional `currency` column isn't there yet.
      if (error && /currency/i.test(error.message)) {
        const stripped = items.map((it) => {
          const copy = { ...it };
          delete copy.currency;
          return copy;
        });
        ({ data, error } = await scopedInsert(supabase, 'fridge_items', scope, stripped));
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data });
    }

    if (op === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const query = applyDataScope(supabase.from('fridge_items').delete().eq('id', id), scope);
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (op === 'consume') {
      const { id, action } = body;
      if (!id || (action !== 'eaten' && action !== 'wasted')) {
        return NextResponse.json({ error: 'Missing id or invalid action' }, { status: 400 });
      }

      const { data: item } = await applyDataScope(
        supabase.from('fridge_items').select('*').eq('id', id),
        scope
      ).maybeSingle();

      const { error: deleteError } = await applyDataScope(
        supabase.from('fridge_items').delete().eq('id', id),
        scope
      );
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      const itemRow = (item || {}) as Record<string, unknown>;
      const priceVal = Number(itemRow.price);
      const logRow: Record<string, unknown> = {
        name: (itemRow.name as string) ?? null,
        category: (itemRow.category as string) ?? null,
        action,
        price: Number.isFinite(priceVal) && priceVal > 0 ? priceVal : null,
        currency: (itemRow.currency as string) ?? null,
      };

      // Best-effort logging: don't fail the action if the log table (or the
      // optional price/currency columns) is missing.
      let { error: logError } = await scopedInsert(supabase, 'fridge_log', scope, [logRow]);
      if (logError && /price|currency/i.test(logError.message)) {
        const basicRow = { name: logRow.name, category: logRow.category, action: logRow.action };
        ({ error: logError } = await scopedInsert(supabase, 'fridge_log', scope, [basicRow]));
      }
      if (logError) {
        console.error('fridge_log insert error:', logError.message);
        return NextResponse.json({ ok: true, logged: false });
      }

      return NextResponse.json({ ok: true, logged: true });
    }

    if (op === 'stats') {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      const { data, error } = await applyDataScope(
        supabase.from('fridge_log').select('action').gte('logged_at', monthStart),
        scope
      );

      if (error) {
        return NextResponse.json({ eaten: 0, wasted: 0, wasteFreeDays: 0, wastedMoney: [], available: false });
      }

      const rows = (data || []) as { action: string }[];
      const eaten = rows.filter((r) => r.action === 'eaten').length;
      const wasted = rows.filter((r) => r.action === 'wasted').length;

      // "No waste" streak: days since the last wasted item (all-time). If nothing
      // was ever wasted, count from the first logged action instead.
      const { data: lastWasted } = await applyDataScope(
        supabase.from('fridge_log').select('logged_at').eq('action', 'wasted')
          .order('logged_at', { ascending: false }).limit(1),
        scope
      ).maybeSingle();
      const { data: firstLog } = await applyDataScope(
        supabase.from('fridge_log').select('logged_at')
          .order('logged_at', { ascending: true }).limit(1),
        scope
      ).maybeSingle();

      let wasteFreeDays = 0;
      const ref = lastWasted?.logged_at || firstLog?.logged_at;
      if (ref) {
        wasteFreeDays = Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86400000));
      }

      // Money thrown away this month (best-effort: requires the price/currency
      // columns on fridge_log; returns an empty list if they're missing).
      let wastedMoney: { currency: string; amount: number }[] = [];
      const { data: moneyRows, error: moneyError } = await applyDataScope(
        supabase.from('fridge_log').select('price, currency')
          .eq('action', 'wasted').gte('logged_at', monthStart),
        scope
      );
      if (!moneyError && moneyRows) {
        const byCurrency: Record<string, number> = {};
        for (const r of moneyRows as { price: number | null; currency: string | null }[]) {
          const amt = Number(r.price) || 0;
          if (amt <= 0) continue;
          const cur = r.currency || 'RUB';
          byCurrency[cur] = (byCurrency[cur] || 0) + amt;
        }
        wastedMoney = Object.entries(byCurrency).map(([currency, amount]) => ({ currency, amount }));
      }

      return NextResponse.json({ eaten, wasted, wasteFreeDays, wastedMoney, available: true });
    }

    if (op === 'history') {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      const primary = await applyDataScope(
        supabase.from('fridge_log').select('id, name, category, action, logged_at, price, currency')
          .gte('logged_at', monthStart).order('logged_at', { ascending: false }),
        scope
      );
      let data: unknown[] | null = primary.data;
      let error = primary.error;
      // Fall back to the base columns if price/currency aren't there yet.
      if (error && /price|currency/i.test(error.message)) {
        const fallback = await applyDataScope(
          supabase.from('fridge_log').select('id, name, category, action, logged_at')
            .gte('logged_at', monthStart).order('logged_at', { ascending: false }),
          scope
        );
        data = fallback.data;
        error = fallback.error;
      }

      if (error) return NextResponse.json({ items: [] });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'clear_history') {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const { error } = await applyDataScope(
        supabase.from('fridge_log').delete().gte('logged_at', monthStart),
        scope
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status });
  }
}

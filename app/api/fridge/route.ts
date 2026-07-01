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

      const { data, error } = await scopedInsert(supabase, 'fridge_items', scope, items);
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
        supabase.from('fridge_items').select('name, category').eq('id', id),
        scope
      ).maybeSingle();

      const { error: deleteError } = await applyDataScope(
        supabase.from('fridge_items').delete().eq('id', id),
        scope
      );
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Best-effort logging: don't fail the action if the log table is missing.
      const { error: logError } = await scopedInsert(supabase, 'fridge_log', scope, [
        {
          name: item?.name ?? null,
          category: item?.category ?? null,
          action,
        },
      ]);
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
        return NextResponse.json({ eaten: 0, wasted: 0, available: false });
      }

      const rows = (data || []) as { action: string }[];
      const eaten = rows.filter((r) => r.action === 'eaten').length;
      const wasted = rows.filter((r) => r.action === 'wasted').length;
      return NextResponse.json({ eaten, wasted, available: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope, scopedInsert } from '@/lib/data-scope';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InsertRow = {
  name: string;
  quantity?: string | null;
  source?: string;
  fridge_item_id?: string | null;
};

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
        supabase.from('shopping_list_items').select('*'),
        scope
      )
        .order('checked', { ascending: true })
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'count') {
      const query = applyDataScope(
        supabase
          .from('shopping_list_items')
          .select('*', { count: 'exact', head: true })
          .eq('checked', false),
        scope
      );
      const { count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count || 0 });
    }

    if (op === 'insert') {
      const rows = (body.items as InsertRow[]) || (body.item ? [body.item as InsertRow] : []);
      if (!rows.length) {
        return NextResponse.json({ error: 'No items' }, { status: 400 });
      }

      const inserted = [];
      for (const row of rows) {
        const name = String(row.name || '').trim();
        if (!name) continue;

        const existingQuery = applyDataScope(
          supabase.from('shopping_list_items').select('id').eq('checked', false).ilike('name', name),
          scope
        );
        const { data: existing } = await existingQuery.maybeSingle();

        if (existing) {
          inserted.push(existing);
          continue;
        }

        const { data, error } = await scopedInsert(supabase, 'shopping_list_items', scope, [
          {
            name,
            quantity: row.quantity || null,
            source: row.source || 'manual',
            fridge_item_id: row.fridge_item_id || null,
          },
        ]);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (data?.[0]) inserted.push(data[0]);
      }

      return NextResponse.json({ items: inserted });
    }

    if (op === 'toggle') {
      const { id, checked } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const query = applyDataScope(
        supabase.from('shopping_list_items').update({ checked: Boolean(checked) }).eq('id', id),
        scope
      );
      const { data, error } = await query.select('*').maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (op === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const query = applyDataScope(
        supabase.from('shopping_list_items').delete().eq('id', id),
        scope
      );
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (op === 'clear_checked') {
      const query = applyDataScope(
        supabase.from('shopping_list_items').delete().eq('checked', true),
        scope
      );
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

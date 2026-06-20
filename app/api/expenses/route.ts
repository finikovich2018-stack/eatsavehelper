import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope, scopedInsert } from '@/lib/data-scope';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
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

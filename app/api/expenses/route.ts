import { NextRequest, NextResponse } from 'next/server';
import { ensureHouseholdContext } from '@/lib/household';
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
    const household = await ensureHouseholdContext(supabase, userId);
    const hid = household.householdId;

    if (op === 'list') {
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('household_id', hid)
        .order('date', { ascending: false });

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
      const { data, error } = await supabase
        .from('expenses')
        .insert({ ...item, telegram_user_id: userId, household_id: hid })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    if (op === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('household_id', hid);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

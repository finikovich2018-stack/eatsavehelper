import { NextRequest, NextResponse } from 'next/server';
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

    if (op === 'list') {
      const days = Number(body.days) || 7;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('telegram_user_id', userId)
        .gte('scanned_at', since.toISOString())
        .order('scanned_at', { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'count') {
      const { count, error } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count || 0 });
    }

    if (op === 'insert') {
      const row = body.row as Record<string, unknown>;
      if (!row) return NextResponse.json({ error: 'Missing row' }, { status: 400 });
      const { error } = await supabase
        .from('receipts')
        .insert({ ...row, telegram_user_id: userId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (op === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', id)
        .eq('telegram_user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

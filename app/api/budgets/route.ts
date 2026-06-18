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
      const { month } = body;
      if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 });
      const { data, error } = await supabase
        .from('budgets')
        .select('amount, currency')
        .eq('telegram_user_id', userId)
        .eq('month', month);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'upsert') {
      const { month, amount, currency } = body;
      if (!month || amount == null || !currency) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const { error } = await supabase.from('budgets').upsert(
        {
          telegram_user_id: userId,
          month,
          amount: Number(amount),
          currency,
        },
        { onConflict: 'telegram_user_id,month,currency' }
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

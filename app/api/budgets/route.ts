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
      const { month } = body;
      if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 });
      const { data, error } = await supabase
        .from('budgets')
        .select('amount, currency')
        .eq('household_id', hid)
        .eq('month', month);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'upsert') {
      const { month, amount, currency } = body;
      if (!month || amount == null || !currency) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const { data: existing } = await supabase
        .from('budgets')
        .select('id')
        .eq('household_id', hid)
        .eq('month', month)
        .eq('currency', currency)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('budgets')
          .update({ amount: Number(amount) })
          .eq('id', existing.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const { error } = await supabase.from('budgets').insert({
          telegram_user_id: household.ownerTelegramId,
          household_id: hid,
          month,
          amount: Number(amount),
          currency,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

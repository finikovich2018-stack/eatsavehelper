import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope } from '@/lib/data-scope';
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
      const { month } = body;
      if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 });
      const query = applyDataScope(
        supabase.from('budgets').select('amount, currency'),
        scope
      ).eq('month', month);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'upsert') {
      const { month, amount, currency } = body;
      if (!month || amount == null || !currency) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }

      let ownerId = userId;
      if (scope.householdId) {
        const { data: household } = await supabase
          .from('households')
          .select('owner_telegram_user_id')
          .eq('id', scope.householdId)
          .maybeSingle();
        ownerId = household?.owner_telegram_user_id ?? userId;
      }

      const baseRow = {
        telegram_user_id: ownerId,
        month,
        amount: Number(amount),
        currency,
      };
      const row = scope.householdId ? { ...baseRow, household_id: scope.householdId } : baseRow;

      // Single atomic upsert keyed on the table's UNIQUE (telegram_user_id,
      // month, currency) constraint — avoids the select-then-insert-or-update
      // race where two parallel saves (double tap, two tabs) could both see
      // "no existing row" and both insert, creating duplicate budget rows.
      const { error } = await supabase
        .from('budgets')
        .upsert(row, { onConflict: 'telegram_user_id,month,currency' });

      if (error && scope.householdId && error.message.includes('household_id')) {
        const { error: retry } = await supabase
          .from('budgets')
          .upsert(baseRow, { onConflict: 'telegram_user_id,month,currency' });
        if (retry) return NextResponse.json({ error: retry.message }, { status: 500 });
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

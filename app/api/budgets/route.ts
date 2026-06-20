import { NextRequest, NextResponse } from 'next/server';
import { applyDataScope, resolveDataScope } from '@/lib/data-scope';
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
        const ctx = await ensureHouseholdContext(supabase, userId);
        ownerId = ctx.ownerTelegramId;
      }

      const existingQuery = applyDataScope(
        supabase.from('budgets').select('id'),
        scope
      )
        .eq('month', month)
        .eq('currency', currency);
      const { data: existing } = await existingQuery.maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('budgets')
          .update({ amount: Number(amount) })
          .eq('id', existing.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        const row: Record<string, unknown> = {
          telegram_user_id: ownerId,
          month,
          amount: Number(amount),
          currency,
        };
        if (scope.householdId) row.household_id = scope.householdId;
        const { error } = await supabase.from('budgets').insert(row);
        if (error && scope.householdId && error.message.includes('household_id')) {
          const { error: retry } = await supabase.from('budgets').insert({
            telegram_user_id: ownerId,
            month,
            amount: Number(amount),
            currency,
          });
          if (retry) return NextResponse.json({ error: retry.message }, { status: 500 });
        } else if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

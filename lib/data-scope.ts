import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { backfillHouseholdData, ensureHouseholdContext } from '@/lib/household';

export type DataScope = {
  householdId: string | null;
  memberIds: number[];
  userId: number;
};

/** Resolve household scope; backfill legacy rows; fall back to solo user if household DB missing. */
export async function resolveDataScope(
  supabase: SupabaseClient,
  userId: number
): Promise<DataScope> {
  try {
    const ctx = await ensureHouseholdContext(supabase, userId);
    for (const m of ctx.members) {
      await backfillHouseholdData(supabase, ctx.householdId, m.telegram_user_id);
    }
    return {
      householdId: ctx.householdId,
      memberIds: ctx.members.map((m) => m.telegram_user_id),
      userId,
    };
  } catch {
    return { householdId: null, memberIds: [userId], userId };
  }
}

type FilterBuilder = PostgrestFilterBuilder<any, any, any, any, any>;

/** Match rows for this user/household, including legacy rows without household_id. */
export function applyDataScope<T extends FilterBuilder>(query: T, scope: DataScope): T {
  if (scope.householdId) {
    return query.or(
      `household_id.eq.${scope.householdId},and(household_id.is.null,telegram_user_id.in.(${scope.memberIds.join(',')}))`
    ) as T;
  }
  return query.eq('telegram_user_id', scope.userId) as T;
}

export function rowWithScope(
  scope: DataScope,
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...row,
    telegram_user_id: scope.userId,
  };
  if (scope.householdId) {
    out.household_id = scope.householdId;
  }
  return out;
}

/** Insert with household_id; retry without if column is missing in DB. */
export async function scopedInsert(
  supabase: SupabaseClient,
  table: string,
  scope: DataScope,
  rows: Record<string, unknown>[]
) {
  const withScope = rows.map((r) => rowWithScope(scope, r));
  let result = await supabase.from(table).insert(withScope).select();

  if (!result.error || !result.error.message.includes('household_id')) {
    return result;
  }

  const legacyRows = rows.map((r) => ({
    ...r,
    telegram_user_id: scope.userId,
  }));
  return supabase.from(table).insert(legacyRows).select();
}

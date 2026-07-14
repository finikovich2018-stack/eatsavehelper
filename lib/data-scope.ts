import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type DataScope = {
  householdId: string | null;
  memberIds: number[];
  userId: number;
};

/** Lightweight scope lookup — no backfill, no household creation. */
export async function resolveDataScope(
  supabase: SupabaseClient,
  userId: number
): Promise<DataScope> {
  // These two lookups are independent (different tables, same userId), so run
  // them in parallel instead of only querying household_members after users
  // comes back empty. For the common case (a solo user, no household) that
  // previously meant two sequential round trips before any of the home
  // screen's real queries could even start.
  const [{ data: user }, { data: membership }] = await Promise.all([
    supabase.from('users').select('household_id').eq('telegram_user_id', userId).maybeSingle(),
    supabase
      .from('household_members')
      .select('household_id')
      .eq('telegram_user_id', userId)
      .maybeSingle(),
  ]);

  const householdId = user?.household_id ?? membership?.household_id ?? null;

  return { householdId, memberIds: [userId], userId };
}

type FilterBuilder = PostgrestFilterBuilder<any, any, any, any, any>;

/** Match rows for this user/household (indexed household_id when available). */
export function applyDataScope<T extends FilterBuilder>(query: T, scope: DataScope): T {
  if (scope.householdId) {
    return query.eq('household_id', scope.householdId) as T;
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

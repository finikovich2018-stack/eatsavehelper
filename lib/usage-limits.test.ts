import { describe, expect, it } from 'vitest';
import { consumeScanSlot, refundScanSlot, UsageLimitError } from '@/lib/usage-limits';

/**
 * Regression tests for a bug found on 2026-07-07:
 * - increment endpoints used a plain read-then-write (no CAS), which could
 *   race under parallel requests and let the free quota be bypassed or an
 *   increment silently lost.
 * - the AI routes consumed a scan/recipe slot BEFORE calling the AI model,
 *   with no refund if the AI call failed, burning the user's free quota
 *   on transient errors.
 *
 * These tests guard against regressing back to the unsafe pattern.
 */

function makeSupabaseStub(initialCount: number) {
  let count = initialCount;

  const chain: any = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    update(payload: { scans_this_month: number }) {
      return {
        eq: () => ({
          eq: (_col2: string, expected: number) => ({
            select: () => ({
              maybeSingle: async () => {
                if (count !== expected) {
                  return { data: null }; // CAS mismatch: someone else already wrote
                }
                count = payload.scans_this_month;
                return { data: { scans_this_month: count } };
              },
            }),
          }),
        }),
      };
    },
    maybeSingle: async () => ({
      data: {
        telegram_user_id: 1,
        scans_this_month: count,
        scans_month: new Date().toISOString().slice(0, 7),
        ai_recipes_this_month: 0,
        ai_recipes_month: new Date().toISOString().slice(0, 7),
        is_premium: false,
      },
    }),
  };

  return { from: () => chain, __getCount: () => count } as any;
}

describe('consumeScanSlot (atomic CAS)', () => {
  it('throws UsageLimitError once the free limit is reached', async () => {
    const supabase = makeSupabaseStub(3); // already at the free limit
    await expect(consumeScanSlot(supabase, 1)).rejects.toThrow(UsageLimitError);
  });

  it('increments by exactly one under a single call', async () => {
    const supabase = makeSupabaseStub(0);
    const result = await consumeScanSlot(supabase, 1);
    expect(result).toBe(1);
  });
});

describe('refundScanSlot', () => {
  it('decrements the count back down after a failed AI call', async () => {
    const supabase = makeSupabaseStub(1);
    await refundScanSlot(supabase, 1);
    expect(supabase.__getCount()).toBe(0);
  });

  it('never goes below zero', async () => {
    const supabase = makeSupabaseStub(0);
    await refundScanSlot(supabase, 1);
    expect(supabase.__getCount()).toBe(0);
  });
});

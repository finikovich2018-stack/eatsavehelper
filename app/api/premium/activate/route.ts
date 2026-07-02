import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { activatePremium } from '@/lib/premium';
import {
  hasRecoverablePremiumPayment,
  markLatestPaymentActivated,
} from '@/lib/premium-payments';
import { verifyApiUser } from '@/lib/verify-api-user';
import { normalizeUser, isPremiumActive } from '@/lib/user-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Activate Premium only if a recent Stars payment was logged */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const tgUser = auth.tgUser;

    const supabase = getSupabaseAdmin();

    const { data: current } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', tgUser.id)
      .maybeSingle();

    if (current && isPremiumActive(current)) {
      return NextResponse.json({ ok: true, user: normalizeUser(current) });
    }

    const canRecover = await hasRecoverablePremiumPayment(supabase, tgUser.id);
    if (!canRecover) {
      return NextResponse.json(
        { error: 'No recent Stars payment found. Pay in the app first.' },
        { status: 403 }
      );
    }

    await activatePremium(tgUser.id);
    await markLatestPaymentActivated(supabase, tgUser.id);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', tgUser.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: normalizeUser(data) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Activation failed';
    console.error('Premium activate error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

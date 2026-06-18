import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/admin';
import { activatePremium } from '@/lib/premium';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';
import { normalizeUser } from '@/lib/user-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Admin-only: grant Premium for 30 days (support / missing payment log) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!isAdminTelegramId(auth.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetId = Number(body.target_telegram_user_id ?? body.telegram_user_id);
    if (!Number.isFinite(targetId) || targetId <= 0) {
      return NextResponse.json({ error: 'Invalid telegram_user_id' }, { status: 400 });
    }

    await activatePremium(targetId);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', targetId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: normalizeUser(data) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

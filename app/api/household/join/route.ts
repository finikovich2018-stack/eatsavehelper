import { NextRequest, NextResponse } from 'next/server';
import { joinHouseholdByToken } from '@/lib/household';
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

    const token = String(body.token || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const ctx = await joinHouseholdByToken(supabase, auth.userId, token);

    return NextResponse.json({
      ok: true,
      householdId: ctx.householdId,
      memberCount: ctx.memberCount,
      members: ctx.members,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

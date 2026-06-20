import { NextRequest, NextResponse } from 'next/server';
import {
  createHouseholdInvite,
  ensureHouseholdContext,
  getHouseholdContext,
  leaveHousehold,
  ownerHasPremium,
  removeHouseholdMember,
} from '@/lib/household';
import { MAX_HOUSEHOLD_MEMBERS } from '@/lib/constants';
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

    if (op === 'get') {
      const ctx = await ensureHouseholdContext(supabase, userId);
      const ownerPremium = await ownerHasPremium(supabase, ctx);
      return NextResponse.json({
        householdId: ctx.householdId,
        role: ctx.role,
        members: ctx.members,
        memberCount: ctx.memberCount,
        maxMembers: MAX_HOUSEHOLD_MEMBERS,
        ownerHasPremium: ownerPremium,
        canInvite: ctx.role === 'owner' && ownerPremium && ctx.memberCount < MAX_HOUSEHOLD_MEMBERS,
      });
    }

    if (op === 'invite') {
      const invite = await createHouseholdInvite(supabase, userId);
      return NextResponse.json({ ok: true, ...invite });
    }

    if (op === 'leave') {
      const ctx = await leaveHousehold(supabase, userId);
      return NextResponse.json({ ok: true, memberCount: ctx.memberCount });
    }

    if (op === 'remove_member') {
      const memberId = Number(body.member_telegram_user_id);
      if (!Number.isFinite(memberId)) {
        return NextResponse.json({ error: 'Invalid member id' }, { status: 400 });
      }
      const ctx = await removeHouseholdMember(supabase, userId, memberId);
      return NextResponse.json({ ok: true, members: ctx.members, memberCount: ctx.memberCount });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

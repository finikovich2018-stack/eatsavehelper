import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Save the user's daily reminder hour (0-23, local) and timezone. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const userId = auth.userId;
    const patch: Record<string, unknown> = {
      telegram_user_id: userId,
      telegram_chat_id: Number(body.telegram_chat_id ?? userId),
    };

    if (body.notify_hour !== undefined && body.notify_hour !== null) {
      const hour = Number(body.notify_hour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        return NextResponse.json(
          { error: 'notify_hour must be an integer between 0 and 23' },
          { status: 400 }
        );
      }
      patch.notify_hour = hour;
    }

    if (body.timezone !== undefined && body.timezone !== null) {
      if (!isValidTimezone(body.timezone)) {
        return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
      }
      patch.timezone = body.timezone;
    }

    if (body.enable_notifications === true) {
      patch.notifications_enabled = true;
    }

    for (const key of ['notify_shopping', 'notify_expiring', 'notify_expired'] as const) {
      if (body[key] !== undefined && body[key] !== null) {
        patch[key] = Boolean(body[key]);
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .upsert(patch, { onConflict: 'telegram_user_id' })
      .select('notifications_enabled, notify_hour, timezone, notify_shopping, notify_expiring, notify_expired')
      .maybeSingle();

    if (error) {
      console.error('Notification settings error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications_enabled: data?.notifications_enabled ?? true,
      notify_hour: data?.notify_hour ?? 12,
      timezone: data?.timezone ?? 'Europe/Moscow',
      notify_shopping: data?.notify_shopping ?? true,
      notify_expiring: data?.notify_expiring ?? true,
      notify_expired: data?.notify_expired ?? true,
    });
  } catch (e) {
    console.error('Notification settings error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

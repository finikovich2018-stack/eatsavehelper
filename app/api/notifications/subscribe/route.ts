import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Save chat_id / enable notifications. register_only=true keeps notifications_enabled unchanged. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { telegram_chat_id, register_only, timezone } = body;
    const userId = auth.userId;
    const chatId = Number(telegram_chat_id ?? userId);

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chat id' }, { status: 400 });
    }

    let validTimezone: string | null = null;
    if (typeof timezone === 'string' && timezone.trim()) {
      try {
        Intl.DateTimeFormat('en-US', { timeZone: timezone });
        validTimezone = timezone;
      } catch {
        validTimezone = null;
      }
    }

    const supabase = getSupabaseAdmin();

    if (register_only) {
      const registerPatch: Record<string, unknown> = { telegram_chat_id: chatId };
      if (validTimezone) registerPatch.timezone = validTimezone;

      const { data, error } = await supabase
        .from('users')
        .update(registerPatch)
        .eq('telegram_user_id', userId)
        .select('notifications_enabled')
        .maybeSingle();

      if (data) {
        return NextResponse.json({
          ok: true,
          notifications_enabled: data.notifications_enabled ?? true,
        });
      }

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // User not created yet — get-or-create runs on app open; skip bare upsert.
      return NextResponse.json({ ok: true, notifications_enabled: true });
    }

    const patch: Record<string, unknown> = {
      telegram_chat_id: chatId,
      notifications_enabled: true,
    };

    if (validTimezone) patch.timezone = validTimezone;

    const { data: existing } = await supabase
      .from('users')
      .select('telegram_user_id')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('telegram_user_id', userId)
      .select('notifications_enabled')
      .maybeSingle();

    if (error) {
      console.error('Subscribe upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications_enabled: data?.notifications_enabled ?? true,
    });
  } catch (e) {
    console.error('Subscribe error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

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

    const { telegram_chat_id, register_only } = body;
    const userId = auth.userId;
    const chatId = Number(telegram_chat_id ?? userId);

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chat id' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (register_only) {
      const { data, error } = await supabase
        .from('users')
        .update({ telegram_chat_id: chatId })
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
    }

    const patch: Record<string, unknown> = {
      telegram_user_id: userId,
      telegram_chat_id: chatId,
    };

    if (!register_only) {
      patch.notifications_enabled = true;
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(patch, { onConflict: 'telegram_user_id' })
      .select('notifications_enabled')
      .maybeSingle();

    if (error) {
      console.error('Subscribe upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications_enabled: data?.notifications_enabled ?? !register_only,
    });
  } catch (e) {
    console.error('Subscribe error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

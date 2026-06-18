import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { FREE_FRIDGE_ITEMS } from '@/lib/constants';
import { getUserWithLimits } from '@/lib/usage-limits';
import { isPremiumActive } from '@/lib/user-utils';
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

    if (op === 'list') {
      const { data, error } = await supabase
        .from('fridge_items')
        .select('*')
        .eq('telegram_user_id', userId)
        .order('expiry_date', { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data || [] });
    }

    if (op === 'count') {
      const { count, error } = await supabase
        .from('fridge_items')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ count: count || 0 });
    }

    if (op === 'insert') {
      const items = body.items as Record<string, unknown>[];
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'No items' }, { status: 400 });
      }

      const user = await getUserWithLimits(supabase, userId);
      if (!user || !isPremiumActive(user)) {
        const { count } = await supabase
          .from('fridge_items')
          .select('*', { count: 'exact', head: true })
          .eq('telegram_user_id', userId);
        if ((count || 0) + items.length > FREE_FRIDGE_ITEMS) {
          return NextResponse.json(
            { error: 'Fridge limit reached', code: 'fridge_limit', limit: FREE_FRIDGE_ITEMS },
            { status: 429 }
          );
        }
      }

      const rows = items.map((item) => ({
        ...item,
        telegram_user_id: userId,
      }));
      const { data, error } = await supabase.from('fridge_items').insert(rows).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ items: data });
    }

    if (op === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const { error } = await supabase
        .from('fridge_items')
        .delete()
        .eq('id', id)
        .eq('telegram_user_id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status });
  }
}

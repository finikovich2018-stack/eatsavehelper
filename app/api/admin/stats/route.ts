import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId, getAdminTelegramIds } from '@/lib/admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyApiUser } from '@/lib/verify-api-user';
import { isPremiumActive } from '@/lib/user-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const supabase = getSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      usersRes,
      newWeekRes,
      newTodayRes,
      notifyRes,
      receiptsRes,
      fridgeRes,
      recipesRes,
      recentRes,
      premiumRowsRes,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('notifications_enabled', true),
      supabase.from('receipts').select('*', { count: 'exact', head: true }),
      supabase.from('fridge_items').select('*', { count: 'exact', head: true }),
      supabase.from('saved_recipes').select('*', { count: 'exact', head: true }),
      supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('users')
        .select('is_premium, premium_until')
        .eq('is_premium', true),
    ]);

    const premiumUsers = (premiumRowsRes.data || []).filter((row) => isPremiumActive(row)).length;

    if (recentRes.error) {
      return NextResponse.json({ error: recentRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      stats: {
        totalUsers: usersRes.count || 0,
        newLast7Days: newWeekRes.count || 0,
        newToday: newTodayRes.count || 0,
        premiumUsers,
        notificationsOn: notifyRes.count || 0,
        totalReceipts: receiptsRes.count || 0,
        totalFridgeItems: fridgeRes.count || 0,
        totalSavedRecipes: recipesRes.count || 0,
      },
      recentUsers: (recentRes.data || []).map((row) => ({
        telegram_user_id: row.telegram_user_id,
        first_name: row.first_name ?? null,
        username: row.username ?? null,
        is_premium: isPremiumActive(row),
        created_at: row.created_at,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

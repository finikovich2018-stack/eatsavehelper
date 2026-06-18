import { NextRequest, NextResponse } from 'next/server';
import { isAdminTelegramId } from '@/lib/admin';
import { verifyApiUser } from '@/lib/verify-api-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = verifyApiUser(body);
    if (!auth.ok) {
      return NextResponse.json({ admin: false });
    }
    return NextResponse.json({ admin: isAdminTelegramId(auth.userId) });
  } catch {
    return NextResponse.json({ admin: false });
  }
}

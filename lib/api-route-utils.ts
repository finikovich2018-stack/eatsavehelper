import { NextResponse } from 'next/server';
import { verifyApiUser } from '@/lib/verify-api-user';

export function unauthorized(auth: ReturnType<typeof verifyApiUser>) {
  if (auth.ok) return null;
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export function requireUser(body: { initData?: string; telegram_user_id?: number }) {
  const auth = verifyApiUser(body);
  if (!auth.ok) {
    throw Object.assign(new Error(auth.error), { status: auth.status });
  }
  return auth;
}

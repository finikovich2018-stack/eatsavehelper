import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramLoginWidget, type TelegramLoginPayload } from '@/lib/telegram-login-verify';
import { mintSyntheticInitData } from '@/lib/synthetic-session';

export const dynamic = 'force-dynamic';

/**
 * POST — verify a Telegram Login Widget payload and return a session
 * (initData + user) the browser can store via writeTelegramSession().
 * The existing Mini App auth pipeline (verifyApiUser, get-or-create, etc.)
 * picks this up unchanged — see lib/synthetic-session.ts for why.
 */
export async function POST(req: NextRequest) {
  let payload: TelegramLoginPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
  }

  if (!payload?.id || !payload?.hash || !payload?.auth_date) {
    return NextResponse.json({ error: 'Отсутствуют обязательные поля' }, { status: 400 });
  }

  if (!verifyTelegramLoginWidget(payload)) {
    return NextResponse.json({ error: 'Не удалось подтвердить вход через Telegram' }, { status: 401 });
  }

  const user = {
    id: payload.id,
    first_name: payload.first_name || 'Пользователь',
    username: payload.username,
  };

  let initData: string;
  try {
    initData = mintSyntheticInitData(user);
  } catch (err) {
    console.error('mintSyntheticInitData failed:', err);
    return NextResponse.json({ error: 'Сервер временно недоступен' }, { status: 500 });
  }

  return NextResponse.json({ initData, user });
}

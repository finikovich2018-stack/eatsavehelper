const INIT_KEY = 'eatsave_tg_init';
const USER_KEY = 'eatsave_tg_user';

export type StoredTelegramUser = {
  id: number;
  first_name: string;
  username?: string;
  is_premium?: boolean;
};

export function readTelegramSession(): { initData: string; user: StoredTelegramUser } | null {
  if (typeof window === 'undefined') return null;
  try {
    const initData = sessionStorage.getItem(INIT_KEY) || '';
    const userRaw = sessionStorage.getItem(USER_KEY);
    if (!initData || !userRaw) return null;
    const user = JSON.parse(userRaw) as StoredTelegramUser;
    if (!user?.id) return null;
    return { initData, user };
  } catch {
    return null;
  }
}

export function writeTelegramSession(initData: string, user: StoredTelegramUser) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(INIT_KEY, initData);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* private mode / quota */
  }
}

export function clearTelegramSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(INIT_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

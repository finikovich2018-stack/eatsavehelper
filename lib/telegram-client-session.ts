const INIT_KEY = 'eatsave_tg_init';
const USER_KEY = 'eatsave_tg_user';

export type StoredTelegramUser = {
  id: number;
  first_name: string;
  username?: string;
  is_premium?: boolean;
};

function readStorage(storage: Storage): { initData: string; user: StoredTelegramUser } | null {
  try {
    const initData = storage.getItem(INIT_KEY) || '';
    const userRaw = storage.getItem(USER_KEY);
    if (!initData || !userRaw) return null;
    const user = JSON.parse(userRaw) as StoredTelegramUser;
    if (!user?.id) return null;
    return { initData, user };
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, initData: string, user: StoredTelegramUser) {
  try {
    storage.setItem(INIT_KEY, initData);
    storage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* quota / private mode */
  }
}

export function readTelegramSession(): { initData: string; user: StoredTelegramUser } | null {
  if (typeof window === 'undefined') return null;
  return readStorage(sessionStorage) || readStorage(localStorage);
}

export function writeTelegramSession(initData: string, user: StoredTelegramUser) {
  if (typeof window === 'undefined') return;
  writeStorage(sessionStorage, initData, user);
  writeStorage(localStorage, initData, user);
}

export function clearTelegramSession() {
  if (typeof window === 'undefined') return;
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.removeItem(INIT_KEY);
      storage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }
}

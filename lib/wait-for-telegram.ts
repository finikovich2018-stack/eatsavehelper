import { readTelegramSession, writeTelegramSession, type StoredTelegramUser } from '@/lib/telegram-client-session';

export type TelegramWebAppSession = {
  tgApp: {
    ready: () => void;
    expand: () => void;
    initDataUnsafe?: { start_param?: string; user?: StoredTelegramUser };
  };
  user: StoredTelegramUser;
  initData: string;
};

function stubTgApp(user: StoredTelegramUser): TelegramWebAppSession['tgApp'] {
  return {
    ready: () => {},
    expand: () => {},
    initDataUnsafe: { user },
  };
}

function readLiveSession(): TelegramWebAppSession | null {
  const tgApp = (window as { Telegram?: { WebApp?: TelegramWebAppSession['tgApp'] & { initData?: string } } })
    .Telegram?.WebApp;
  if (!tgApp) return null;

  try {
    tgApp.ready();
  } catch {
    /* optional */
  }

  const user = tgApp.initDataUnsafe?.user;
  const initData = tgApp.initData || '';
  if (!user?.id || !initData) return null;

  writeTelegramSession(initData, user);
  return { tgApp, user, initData };
}

function sessionFromCache(): TelegramWebAppSession | null {
  const cached = readTelegramSession();
  if (!cached) return null;

  const live = readLiveSession();
  if (live) return live;

  const tgApp =
    (window as { Telegram?: { WebApp?: TelegramWebAppSession['tgApp'] } }).Telegram?.WebApp ||
    stubTgApp(cached.user);

  return { tgApp, user: cached.user, initData: cached.initData };
}

/** Poll until Telegram WebApp SDK exposes initData (async script may load after React). */
export function waitForTelegramWebApp(maxMs = 20000): Promise<TelegramWebAppSession | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  const immediate = sessionFromCache();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const started = Date.now();

    const tick = () => {
      const session = readLiveSession() || sessionFromCache();
      if (session) {
        resolve(session);
        return;
      }

      if (Date.now() - started >= maxMs) {
        resolve(null);
        return;
      }

      window.setTimeout(tick, 50);
    };

    tick();
  });
}

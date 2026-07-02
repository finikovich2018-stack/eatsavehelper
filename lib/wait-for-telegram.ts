export type TelegramWebAppSession = {
  tgApp: {
    ready: () => void;
    expand: () => void;
    initDataUnsafe?: { start_param?: string; user?: { id: number; first_name: string; username?: string; is_premium?: boolean } };
  };
  user: { id: number; first_name: string; username?: string; is_premium?: boolean };
  initData: string;
};

/** Poll until Telegram WebApp SDK exposes initData (async script may load after React). */
export function waitForTelegramWebApp(maxMs = 15000): Promise<TelegramWebAppSession | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const started = Date.now();

    const tick = () => {
      const tgApp = (window as { Telegram?: { WebApp?: TelegramWebAppSession['tgApp'] & { initData?: string } } })
        .Telegram?.WebApp;
      const user = tgApp?.initDataUnsafe?.user;
      const initData = tgApp?.initData;

      if (user?.id && initData) {
        resolve({ tgApp, user, initData });
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

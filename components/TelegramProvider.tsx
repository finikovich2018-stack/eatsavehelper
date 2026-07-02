"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { prefetchHomeSummary } from "@/lib/home-summary";
import { waitForTelegramWebApp } from "@/lib/wait-for-telegram";
import { readTelegramSession } from "@/lib/telegram-client-session";

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  is_premium?: boolean;
}

export interface DbUser {
  is_premium?: boolean;
  premium_until?: string | null;
  scans_this_month?: number;
  ai_recipes_this_month?: number;
  achievement_bonus_month?: string | null;
  effective_premium?: boolean;
  notifications_enabled?: boolean;
  notify_hour?: number;
  timezone?: string;
}

function getBrowserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

interface TelegramData {
  user: TelegramUser | null;
  dbUser: DbUser | null;
  initData: string;
  loading: boolean;
  refreshUser: () => Promise<DbUser | null>;
}

const TgCtx = createContext<TelegramData>({
  user: null,
  dbUser: null,
  initData: "",
  loading: true,
  refreshUser: async () => null,
});

const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_USER: TelegramUser = { id: 999999, first_name: "Dev User", username: "devuser" };

async function registerChatForNotifications(
  telegramUserId: number,
  telegramChatId: number,
  initData: string
) {
  try {
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData,
        telegram_user_id: telegramUserId,
        telegram_chat_id: telegramChatId,
        register_only: true,
        timezone: getBrowserTimezone(),
      }),
    });
  } catch (e) {
    console.error('Failed to register chat for notifications:', e);
  }
}

/** Sync profile, limits and Premium from DB. */
async function loadDbUser(initData: string, telegramUserId: number): Promise<DbUser | null> {
  const res = await fetch('/api/user/get-or-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, telegram_user_id: telegramUserId }),
  });

  if (!res.ok) {
    console.error('get-or-create failed:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const data = await res.json();
  return (data.user as DbUser) || null;
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [initData, setInitData] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!initData || !user?.id) return null;
    const profile = await loadDbUser(initData, user.id);
    if (profile) setDbUser(profile);
    return profile;
  }, [initData, user?.id]);

  // SSR renders with empty auth — restore cached Telegram session on the client immediately.
  useLayoutEffect(() => {
    const cached = readTelegramSession();
    if (!cached) return;
    setUser(cached.user);
    setInitData(cached.initData);
    setLoading(false);
    prefetchHomeSummary(cached.initData, cached.user.id);
    void loadDbUser(cached.initData, cached.user.id).then((profile) => {
      if (profile) setDbUser(profile);
    });
  }, []);

  useEffect(() => {
    let alive = true;

    const bootstrap = async (
      tgApp: { ready: () => void; expand: () => void; initDataUnsafe?: { start_param?: string } },
      tgUser: TelegramUser,
      rawInitData: string
    ) => {
      try {
        tgApp.ready();
        tgApp.expand();
      } catch {
        /* optional in stub */
      }
      if (!alive) return;

      setInitData(rawInitData);
      setUser(tgUser);
      setLoading(false);

      prefetchHomeSummary(rawInitData, tgUser.id);

      const profile = await loadDbUser(rawInitData, tgUser.id);
      if (profile && alive) setDbUser(profile);

      void registerChatForNotifications(tgUser.id, tgUser.id, rawInitData);

      const startParam = tgApp.initDataUnsafe?.start_param;
      if (startParam?.startsWith('join_') && profile) {
        void fetch('/api/household/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: rawInitData,
            telegram_user_id: tgUser.id,
            token: startParam,
          }),
        })
          .then(() => loadDbUser(rawInitData, tgUser.id))
          .then((refreshed) => {
            if (refreshed && alive) setDbUser(refreshed);
          })
          .catch((e) => console.error('Household join failed:', e));
      }

      if (startParam?.startsWith('ref_') && profile) {
        void fetch('/api/referral/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: rawInitData,
            telegram_user_id: tgUser.id,
            token: startParam,
          }),
        }).catch((e) => console.error('Referral claim failed:', e));
      }
    };

    void (async () => {
      const session = await waitForTelegramWebApp(20000);
      if (!alive) return;

      if (session) {
        await bootstrap(session.tgApp, session.user, session.initData);
        return;
      }

      if (IS_DEV) {
        setUser(DEV_USER);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <TgCtx.Provider value={{ user, dbUser, initData, loading, refreshUser }}>
      {children}
    </TgCtx.Provider>
  );
}

export const useTelegram = () => useContext(TgCtx);

"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

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

  if (!res.ok) return null;
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

  useEffect(() => {
    const init = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;

        const bootstrap = async (tgApp: typeof tg, tgUser: TelegramUser, rawInitData: string) => {
          tgApp.ready();
          tgApp.expand();
          setInitData(rawInitData);
          setUser(tgUser);
          setLoading(false);

          const profile = await loadDbUser(rawInitData, tgUser.id);
          if (profile) setDbUser(profile);

          void registerChatForNotifications(tgUser.id, tgUser.id, rawInitData);

          const startParam = tgApp.initDataUnsafe?.start_param as string | undefined;
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
                if (refreshed) setDbUser(refreshed);
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

        if (tg?.initDataUnsafe?.user && tg.initData) {
          await bootstrap(tg, tg.initDataUnsafe.user, tg.initData);
          return;
        }

        setTimeout(async () => {
          const tg2 = (window as any).Telegram?.WebApp;
          if (tg2?.initDataUnsafe?.user && tg2.initData) {
            await bootstrap(tg2, tg2.initDataUnsafe.user, tg2.initData);
          } else if (IS_DEV) {
            setUser(DEV_USER);
          }
          setLoading(false);
        }, 500);
      } catch {
        if (IS_DEV) {
          setUser(DEV_USER);
        }
        setLoading(false);
      }
    };

    init();
  }, []);

  return (
    <TgCtx.Provider value={{ user, dbUser, initData, loading, refreshUser }}>
      {children}
    </TgCtx.Provider>
  );
}

export const useTelegram = () => useContext(TgCtx);

"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  is_premium?: boolean;
}

interface DbUser {
  is_premium?: boolean;
  premium_until?: string | null;
  scans_this_month?: number;
  ai_recipes_this_month?: number;
}

interface TelegramData {
  user: TelegramUser | null;
  dbUser: DbUser | null;
  initData: string;
  loading: boolean;
}

const TgCtx = createContext<TelegramData>({
  user: null,
  dbUser: null,
  initData: "",
  loading: true,
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

async function authenticate(initData: string) {
  const res = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.user as DbUser | null;
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [initData, setInitData] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;

        if (tg?.initDataUnsafe?.user && tg.initData) {
          tg.ready();
          tg.expand();
          setInitData(tg.initData);
          setUser(tg.initDataUnsafe.user);

          const profile = await authenticate(tg.initData);
          setDbUser(profile);
          registerChatForNotifications(tg.initDataUnsafe.user.id, tg.initDataUnsafe.user.id, tg.initData);
          setLoading(false);
          return;
        }

        setTimeout(async () => {
          const tg2 = (window as any).Telegram?.WebApp;
          if (tg2?.initDataUnsafe?.user && tg2.initData) {
            tg2.ready();
            tg2.expand();
            setInitData(tg2.initData);
            setUser(tg2.initDataUnsafe.user);
            const profile = await authenticate(tg2.initData);
            setDbUser(profile);
            registerChatForNotifications(tg2.initDataUnsafe.user.id, tg2.initDataUnsafe.user.id, tg2.initData);
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
    <TgCtx.Provider value={{ user, dbUser, initData, loading }}>
      {children}
    </TgCtx.Provider>
  );
}

export const useTelegram = () => useContext(TgCtx);

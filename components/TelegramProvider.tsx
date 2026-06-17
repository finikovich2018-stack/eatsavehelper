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

async function subscribeToNotifications(telegramUserId: number, telegramChatId: number) {
  try {
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_user_id: telegramUserId,
        telegram_chat_id: telegramChatId,
      }),
    });
  } catch (e) {
    console.error("Failed to subscribe to notifications:", e);
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
          subscribeToNotifications(tg.initDataUnsafe.user.id, tg.initDataUnsafe.user.id);
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
            subscribeToNotifications(tg2.initDataUnsafe.user.id, tg2.initDataUnsafe.user.id);
          } else {
            setUser({ id: 999999, first_name: "Dev User", username: "devuser" });
          }
          setLoading(false);
        }, 500);
      } catch {
        setUser({ id: 999999, first_name: "Dev User", username: "devuser" });
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

"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  is_premium?: boolean;
}

const TgCtx = createContext<{ user: TelegramUser | null; initData: string }>(
  { user: null, initData: "" }
);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState("");

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        setInitData(tg.initData || "");
        if (tg.initDataUnsafe?.user) {
          setUser(tg.initDataUnsafe.user);
        }
      } else {
        setUser({ id: 999999, first_name: "Dev User", username: "devuser" });
      }
    } catch {
      setUser({ id: 999999, first_name: "Dev User", username: "devuser" });
    }
  }, []);

  return <TgCtx.Provider value={{ user, initData }}>{children}</TgCtx.Provider>;
}

export const useTelegram = () => useContext(TgCtx);

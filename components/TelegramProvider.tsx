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
  const init = () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.initDataUnsafe?.user) {
        tg.ready();
        tg.expand();
        setInitData(tg.initData || "");
        setUser(tg.initDataUnsafe.user);
      } else {
        // повторить через 500ms
        setTimeout(() => {
          const tg2 = (window as any).Telegram?.WebApp;
          if (tg2 && tg2.initDataUnsafe?.user) {
            tg2.ready();
            tg2.expand();
            setInitData(tg2.initData || "");
            setUser(tg2.initDataUnsafe.user);
          } else {
            setUser({ id: 999999, first_name: "Dev User", username: "devuser" });
          }
        }, 500);
      }
    } catch {
      setUser({ id: 999999, first_name: "Dev User", username: "devuser" });
    }
  };
  init();
}, []);
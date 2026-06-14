"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  is_premium?: boolean;
}

interface TelegramData {
  user: TelegramUser | null;
  initData: string;
}

const TgCtx = createContext<TelegramData>({ user: null, initData: "" });

async function subscribeToNotifications(
  telegramUserId: number,
  telegramChatId: number
) {
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

          // Auto-subscribe to push notifications using the bot's chat_id
          // In Mini App context, we use the bot's token to identify the user
          const tgUser = tg.initDataUnsafe.user;
          const chatId = tgUser.id;
          subscribeToNotifications(tgUser.id, chatId);
        } else {
          // Dev fallback — retry after short delay
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

  return <TgCtx.Provider value={{ user, initData }}>{children}</TgCtx.Provider>;
}

export const useTelegram = () => useContext(TgCtx);

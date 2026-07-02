"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { init as initTelegramSdk } from "@telegram-apps/sdk";
import { prefetchHomeSummary } from "@/lib/home-summary";
import { getTelegramAuthSnapshot } from "@/lib/telegram-auth";

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
  const bootstrappedUserId = useRef<number | null>(null);

  const refreshUser = useCallback(async () => {
    const snap = getTelegramAuthSnapshot();
    const data = snap?.initData || initData;
    const uid = snap?.user.id || user?.id;
    if (!data || !uid) return null;
    const profile = await loadDbUser(data, uid);
    if (profile) setDbUser(profile);
    return profile;
  }, [initData, user?.id]);

  useEffect(() => {
    let alive = true;
    let attempts = 0;
    const maxAttempts = 300;

    try {
      initTelegramSdk();
    } catch {
      /* optional outside Telegram */
    }

    const applySnapshot = async (snap: NonNullable<ReturnType<typeof getTelegramAuthSnapshot>>) => {
      setUser(snap.user);
      setInitData(snap.initData);
      setLoading(false);

      try {
        const tg = (window as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } })
          .Telegram?.WebApp;
        tg?.ready?.();
        tg?.expand?.();
      } catch {
        /* optional */
      }

      if (bootstrappedUserId.current === snap.user.id) return;
      bootstrappedUserId.current = snap.user.id;

      prefetchHomeSummary(snap.initData, snap.user.id);
      const profile = await loadDbUser(snap.initData, snap.user.id);
      if (profile && alive) setDbUser(profile);
      void registerChatForNotifications(snap.user.id, snap.user.id, snap.initData);
    };

    const tick = () => {
      if (!alive) return;

      const snap = getTelegramAuthSnapshot();
      if (snap) {
        void applySnapshot(snap);
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        if (IS_DEV) setUser(DEV_USER);
        setLoading(false);
        return;
      }

      window.setTimeout(tick, 100);
    };

    tick();
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

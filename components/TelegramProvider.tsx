"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { init as initTelegramSdk } from "@telegram-apps/sdk";
import { prefetchHomeSummary } from "@/lib/home-summary";
import { recoverFromStaleAuth } from "@/lib/auth-recovery";
import { getTelegramAuthSnapshot, isTelegramWebView } from "@/lib/telegram-auth";
import {
  deepLinkStorageKey,
  getTelegramStartParam,
} from "@/lib/telegram-start-param";

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
  notify_shopping?: boolean;
  notify_expiring?: boolean;
  notify_expired?: boolean;
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
  authFailed: boolean;
  refreshUser: () => Promise<DbUser | null>;
}

const TgCtx = createContext<TelegramData>({
  user: null,
  dbUser: null,
  initData: "",
  loading: true,
  authFailed: false,
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

async function processDeepLinks(initData: string, telegramUserId: number): Promise<DbUser | null> {
  const startParam = getTelegramStartParam(initData);
  if (!startParam) return null;

  try {
    if (sessionStorage.getItem(deepLinkStorageKey(telegramUserId, startParam))) {
      return null;
    }
  } catch {
    /* sessionStorage unavailable */
  }

  const body = { initData, telegram_user_id: telegramUserId };
  let refreshed: DbUser | null = null;

  try {
    if (startParam.startsWith('ref_')) {
      await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token: startParam }),
      });
    } else if (startParam.startsWith('join_')) {
      await fetch('/api/household/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token: startParam }),
      });
    } else {
      return null;
    }

    try {
      sessionStorage.setItem(deepLinkStorageKey(telegramUserId, startParam), '1');
    } catch {
      /* ignore */
    }

    refreshed = await loadDbUser(initData, telegramUserId);
  } catch (e) {
    console.error('Deep link handling failed:', e);
  }

  return refreshed;
}

async function loadDbUser(initData: string, telegramUserId: number): Promise<DbUser | null> {
  const res = await fetch('/api/user/get-or-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, telegram_user_id: telegramUserId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {
      /* raw text */
    }
    recoverFromStaleAuth(message, res.status);
    console.error('get-or-create failed:', res.status, message);
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
  const [authFailed, setAuthFailed] = useState(false);
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
      let profile = await loadDbUser(snap.initData, snap.user.id);
      const afterDeepLink = await processDeepLinks(snap.initData, snap.user.id);
      if (afterDeepLink) profile = afterDeepLink;
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
        setAuthFailed(!IS_DEV && isTelegramWebView());
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
    <TgCtx.Provider value={{ user, dbUser, initData, loading, authFailed, refreshUser }}>
      {children}
    </TgCtx.Provider>
  );
}

export const useTelegram = () => useContext(TgCtx);

import { useEffect, useMemo } from 'react';
import { useTelegram } from '@/components/TelegramProvider';

export type DataAuth = {
  initData: string;
  telegram_user_id: number;
};

function buildAuth(userId: number | undefined, initData: string): DataAuth | null {
  if (!userId || !initData) return null;
  return { initData, telegram_user_id: userId };
}

/** Auth payload + whether Telegram bootstrap finished (success or not). */
export function useAuthReady(): { auth: DataAuth | null; ready: boolean } {
  const { user, initData, loading } = useTelegram();
  const auth = useMemo(
    () => buildAuth(user?.id, initData),
    [user?.id, initData]
  );
  return { auth, ready: !loading };
}

/** Auth payload for authenticated data API calls. Null until Telegram initData is ready. */
export function useDataAuth(): DataAuth | null {
  return useAuthReady().auth;
}

/** Stop page spinners when Telegram finished booting but initData is missing. */
export function useReleaseLoadingWhenUnauthenticated(
  ready: boolean,
  auth: DataAuth | null,
  ...setters: Array<(value: boolean) => void>
) {
  useEffect(() => {
    if (ready && !auth) {
      setters.forEach((set) => set(false));
    }
    // Setter refs are stable; only re-run when bootstrap finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, auth]);
}

/** Never leave a page spinner running forever (slow network / auth edge cases). */
export function useLoadingTimeout(
  loading: boolean,
  setLoading: (value: boolean) => void,
  timeoutMs = 18_000
) {
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [loading, setLoading, timeoutMs]);
}

import { useMemo } from 'react';
import { useTelegram } from '@/components/TelegramProvider';

export type DataAuth = {
  initData: string;
  telegram_user_id: number;
};

/** Auth payload for authenticated data API calls. Null until Telegram initData is ready. */
export function useDataAuth(): DataAuth | null {
  const { user, initData } = useTelegram();
  return useMemo(() => {
    if (!user?.id || !initData) return null;
    return { initData, telegram_user_id: user.id };
  }, [user?.id, initData]);
}

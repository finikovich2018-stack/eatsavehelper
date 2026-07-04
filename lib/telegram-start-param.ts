import { retrieveLaunchParams } from '@telegram-apps/sdk';

/** Read Mini App start_param (ref_… / join_…) from initData or WebApp SDK. */
export function getTelegramStartParam(initData?: string): string | null {
  if (typeof window !== 'undefined') {
    try {
      const lp = retrieveLaunchParams();
      if (lp.startParam?.trim()) return lp.startParam.trim();
    } catch {
      /* not in Telegram */
    }

    const unsafe = (
      window as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } }
    ).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (unsafe?.trim()) return unsafe.trim();
  }

  if (initData) {
    const fromInit = new URLSearchParams(initData).get('start_param');
    if (fromInit?.trim()) return fromInit.trim();
  }

  return null;
}

export function deepLinkStorageKey(userId: number, startParam: string): string {
  return `eatsave:deeplink:${userId}:${startParam}`;
}

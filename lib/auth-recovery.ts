import { clearTelegramSession } from '@/lib/telegram-client-session';

const AUTH_ERROR_RE = /initData|expired|Invalid initData|Missing initData|User mismatch/i;

let recovering = false;

/** Clear stale auth and reload once when the server rejects initData. */
export function recoverFromStaleAuth(errorMessage: string, status?: number): boolean {
  if (typeof window === 'undefined' || recovering) return recovering;
  if (status !== 401 && status !== 403) return false;
  if (!AUTH_ERROR_RE.test(errorMessage)) return false;

  recovering = true;
  clearTelegramSession();
  delete (window as { __EATSAVE_TG__?: unknown }).__EATSAVE_TG__;

  try {
    (window as { __EATSAVE_CAPTURE_TG__?: () => boolean }).__EATSAVE_CAPTURE_TG__?.();
  } catch {
    /* optional */
  }

  window.location.reload();
  return true;
}

export function isAuthErrorMessage(message: string): boolean {
  return AUTH_ERROR_RE.test(message);
}

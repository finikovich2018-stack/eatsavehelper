import { useAuthReady } from '@/lib/use-data-auth';

/** Shown app-wide when Telegram bootstrap finished but initData/user is missing. */
export default function TelegramAuthBanner() {
  const { auth, ready } = useAuthReady();

  if (!ready || auth) return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
      <p>
        Telegram не передал данные входа. Полностью закройте Mini App и откройте снова через кнопку{' '}
        <span className="whitespace-nowrap">«📱 Открыть EatSave»</span> в боте.
      </p>
      <a href="/tg-status" className="mt-2 inline-block text-accent underline text-xs">
        Диагностика
      </a>
    </div>
  );
}

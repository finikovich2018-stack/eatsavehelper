'use client';

import { TelegramProvider } from './TelegramProvider';
import TelegramAuthBanner from './TelegramAuthBanner';
import SplashDismiss from './SplashDismiss';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TelegramProvider>
      <SplashDismiss />
      <LanguageProvider>
        <TelegramAuthBanner />
        {children}
      </LanguageProvider>
      <ServiceWorkerRegister />
    </TelegramProvider>
  );
}

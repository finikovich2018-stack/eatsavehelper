'use client';

import { TelegramProvider } from './TelegramProvider';
import SplashDismiss from './SplashDismiss';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TelegramProvider>
      <SplashDismiss />
      <LanguageProvider>{children}</LanguageProvider>
      <ServiceWorkerRegister />
    </TelegramProvider>
  );
}

'use client';

import { TelegramProvider } from './TelegramProvider';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TelegramProvider>
      <LanguageProvider>{children}</LanguageProvider>
      <ServiceWorkerRegister />
    </TelegramProvider>
  );
}

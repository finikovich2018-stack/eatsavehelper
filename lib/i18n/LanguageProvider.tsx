'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getDateLocale,
  interpolate,
  translations,
  type Locale,
  type TranslationKey,
} from './translations';

const STORAGE_KEY = 'eatsave_locale';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  dateLocale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function detectTelegramLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const code = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } })
    .Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (code?.startsWith('en')) return 'en';
  if (code?.startsWith('ru')) return 'ru';
  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ru');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      return;
    }
    const detected = detectTelegramLocale();
    if (detected) {
      setLocaleState(detected);
      document.documentElement.lang = detected;
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const str = translations[locale][key] ?? translations.ru[key] ?? key;
      return interpolate(str, params);
    },
    [locale]
  );

  const dateLocale = getDateLocale(locale);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dateLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}

'use client';

import LegalDocument from '@/components/LegalDocument';
import { privacyDocs } from '@/lib/legal-content';
import { useI18n } from '@/lib/i18n/LanguageProvider';

export default function PrivacyPage() {
  const { locale } = useI18n();
  const doc = privacyDocs[locale === 'en' ? 'en' : 'ru'];
  return <LegalDocument doc={doc} />;
}

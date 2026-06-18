'use client';

import LegalDocument from '@/components/LegalDocument';
import { termsDocs } from '@/lib/legal-content';
import { useI18n } from '@/lib/i18n/LanguageProvider';

export default function TermsPage() {
  const { locale } = useI18n();
  const doc = termsDocs[locale === 'en' ? 'en' : 'ru'];
  return <LegalDocument doc={doc} />;
}

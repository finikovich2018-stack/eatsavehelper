'use client';

import TopBar from '@/components/layout/TopBar';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import type { LegalDoc } from '@/lib/legal-content';

export default function LegalDocument({ doc }: { doc: LegalDoc }) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBar title={doc.title} />
      <article className="p-4 space-y-6 max-w-mobile mx-auto">
        <p className="text-xs text-muted">
          {t('legal.updated')}: {doc.updated}
        </p>
        <p className="text-sm text-muted leading-relaxed">{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">{section.heading}</h2>
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}

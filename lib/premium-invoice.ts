import { PREMIUM_PRICE_STARS } from '@/lib/constants';
import type { botLocale } from '@/lib/bot-messages';

type BotLocale = ReturnType<typeof botLocale>;

export function premiumInvoicePayload(telegramUserId: number): string {
  return `premium_${telegramUserId}`;
}

export function buildPremiumInvoiceBody(telegramUserId: number, locale: BotLocale) {
  const ru = locale === 'ru';
  return {
    title: 'EatSave Premium',
    description: ru
      ? `Premium на 30 дней — безлимит сканы, AI-рецепты и семья. ${PREMIUM_PRICE_STARS} Stars`
      : `Premium for 30 days — unlimited scans, AI recipes & family. ${PREMIUM_PRICE_STARS} Stars`,
    payload: premiumInvoicePayload(telegramUserId),
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: ru ? 'Premium (1 месяц)' : 'Premium (1 month)', amount: PREMIUM_PRICE_STARS }],
  };
}

export async function sendPremiumInvoice(
  botToken: string,
  chatId: number,
  telegramUserId: number,
  locale: BotLocale
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendInvoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      ...buildPremiumInvoiceBody(telegramUserId, locale),
    }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  return { ok: data.ok, description: data.description };
}

export async function createPremiumInvoiceLink(
  botToken: string,
  telegramUserId: number,
  locale: BotLocale = 'ru'
): Promise<{ ok: boolean; link?: string; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPremiumInvoiceBody(telegramUserId, locale)),
  });
  const data = (await res.json()) as { ok: boolean; result?: string; description?: string };
  return { ok: data.ok, link: data.result, description: data.description };
}

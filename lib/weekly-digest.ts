import { greetingWithName } from '@/lib/greeting';

export type DigestUser = {
  telegram_user_id: number;
  first_name: string | null;
  chat_id: number;
};

export type Money = { currency: string; amount: number };

export type DigestStats = {
  eaten: number;
  wasted: number;
  wastedMoney: Money[];
  spent: Money[];
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', GBP: '£', UAH: '₴', KZT: '₸',
};

function formatMoney(list: Money[]): string {
  return list
    .filter((m) => m.amount > 0)
    .map((m) => `${Math.round(m.amount).toLocaleString('ru-RU')} ${CURRENCY_SYMBOLS[m.currency] || m.currency}`)
    .join(' + ');
}

/** Roll up an array of {currency, amount} into a deduplicated, sorted list. */
export function sumByCurrency(rows: { currency: string | null; amount: number }[]): Money[] {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    if (amt <= 0) continue;
    const cur = r.currency || 'RUB';
    map[cur] = (map[cur] || 0) + amt;
  }
  return Object.entries(map)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function hasDigestActivity(stats: DigestStats): boolean {
  return (
    stats.eaten > 0 ||
    stats.wasted > 0 ||
    stats.spent.some((m) => m.amount > 0)
  );
}

/**
 * Build the weekly recap message (HTML). Returns null when there was no
 * activity in the past week, so we don't spam idle users.
 */
export function buildWeeklyDigestMessage(user: DigestUser, stats: DigestStats): string | null {
  if (!hasDigestActivity(stats)) return null;

  const name = user.first_name || 'друг';
  const lines: string[] = [];

  lines.push(`🍽 Съедено: <b>${stats.eaten}</b>`);

  const wastedMoney = formatMoney(stats.wastedMoney);
  lines.push(
    `🗑 Выброшено: <b>${stats.wasted}</b>${wastedMoney ? ` (на ${wastedMoney})` : ''}`
  );

  const spent = formatMoney(stats.spent);
  if (spent) {
    lines.push(`💸 Потрачено: <b>${spent}</b>`);
  }

  // A short, encouraging closing line based on how the week went.
  let footer: string;
  if (stats.wasted === 0 && stats.eaten > 0) {
    footer = '🌱 Неделя без выброшенной еды — отличная работа!';
  } else if (stats.eaten >= stats.wasted) {
    footer = 'Так держать! Планируйте покупки, чтобы выбрасывать ещё меньше.';
  } else {
    footer = 'На следующей неделе попробуйте выбросить меньше — вы справитесь!';
  }

  return (
    `📊 <b>EatSave — итоги недели</b>\n\n` +
    `${greetingWithName(name)}\n\n` +
    `${lines.join('\n')}\n\n` +
    `${footer}`
  );
}

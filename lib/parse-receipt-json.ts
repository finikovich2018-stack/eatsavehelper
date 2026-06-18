export type ParsedReceiptItem = {
  name: string;
  quantity?: number;
  price?: number;
  expiry_days?: number;
  category?: string;
  icon?: string;
};

export type ParsedReceipt = {
  currency: string;
  items: ParsedReceiptItem[];
};

function stripMarkdown(text: string): string {
  return text.replace(/```json\s*|```/gi, '').trim();
}

function balanceBrackets(raw: string): string {
  let s = raw.trim();
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const c of s) {
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') braces++;
    if (c === '}') braces--;
    if (c === '[') brackets++;
    if (c === ']') brackets--;
  }

  if (inString) s += '"';
  while (brackets > 0) {
    s += ']';
    brackets--;
  }
  while (braces > 0) {
    s += '}';
    braces--;
  }
  return s;
}

function trimToLastCompleteItem(raw: string): string {
  const idx = raw.lastIndexOf('},');
  if (idx > 0) {
    return raw.slice(0, idx + 1).replace(/,\s*$/, '');
  }
  const brace = raw.lastIndexOf('}');
  if (brace > 0) return raw.slice(0, brace + 1);
  return raw;
}

function normalizeItem(raw: Record<string, unknown>): ParsedReceiptItem | null {
  const name = String(raw.name || '').trim();
  if (!name) return null;

  return {
    name: name.slice(0, 120),
    quantity: Math.max(1, Number(raw.quantity) || 1),
    price: Number(raw.price) || 0,
    expiry_days: Math.max(1, Math.min(365, Number(raw.expiry_days) || 7)),
    category: String(raw.category || 'other'),
    icon: String(raw.icon || '📦'),
  };
}

function normalizeParsed(data: unknown): ParsedReceipt {
  const obj = data as { currency?: string; items?: unknown[] };
  const items = (obj.items || [])
    .map((item) => normalizeItem(item as Record<string, unknown>))
    .filter((item): item is ParsedReceiptItem => item !== null);

  if (items.length === 0) {
    throw new Error('AI не нашёл продукты на чеке');
  }

  return {
    currency: String(obj.currency || 'RUB').toUpperCase().slice(0, 3),
    items,
  };
}

function extractItemsWithRegex(text: string): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const re =
    /\{\s*"name"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"quantity"\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"price"\s*:\s*(\d+(?:\.\d+)?)\s*,\s*"expiry_days"\s*:\s*(\d+)\s*,\s*"category"\s*:\s*"([^"]*)"\s*,\s*"icon"\s*:\s*"([^"]*)"\s*\}/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    items.push({
      name: match[1].replace(/\\"/g, '"').slice(0, 120),
      quantity: Math.max(1, Number(match[2]) || 1),
      price: Number(match[3]) || 0,
      expiry_days: Math.max(1, Number(match[4]) || 7),
      category: match[5] || 'other',
      icon: match[6] || '📦',
    });
  }

  return items;
}

function detectCurrency(text: string): string {
  const m = text.match(/"currency"\s*:\s*"([A-Z]{3})"/i);
  return m ? m[1].toUpperCase() : 'RUB';
}

/** Parse Claude receipt JSON with repair for truncated or slightly malformed output. */
export function parseReceiptJson(text: string): ParsedReceipt {
  const cleaned = stripMarkdown(text);
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('JSON не найден в ответе AI');

  const candidates = [
    cleaned.slice(start),
    balanceBrackets(cleaned.slice(start)),
    balanceBrackets(trimToLastCompleteItem(cleaned.slice(start))),
  ];

  for (const candidate of candidates) {
    try {
      return normalizeParsed(JSON.parse(candidate));
    } catch {
      /* try next strategy */
    }
  }

  const regexItems = extractItemsWithRegex(cleaned);
  if (regexItems.length > 0) {
    return { currency: detectCurrency(cleaned), items: regexItems };
  }

  throw new Error('Не удалось разобрать ответ AI — попробуйте другое фото чека');
}

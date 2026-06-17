export const PREMIUM_PRICE_STARS = 100;
export const PREMIUM_SUBSCRIPTION_PERIOD = 2_592_000; // 30 дней в секундах

/** Claude model with vision — override via ANTHROPIC_MODEL env */
export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

/** Free tier limits */
export const FREE_FRIDGE_ITEMS = 30;
export const FREE_AI_RECIPES_PER_MONTH = 3;
export const FREE_SCANS_PER_MONTH = 3;
export const FREE_RECEIPT_HISTORY_DAYS = 7;
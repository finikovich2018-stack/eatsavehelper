-- budgets, receipts, saved_recipes tables per TZ

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  month DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 15000,
  currency TEXT NOT NULL DEFAULT 'RUB',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (telegram_user_id, month, currency)
);

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  total_amount NUMERIC(10,2) DEFAULT 0,
  store_name TEXT,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  raw_ocr_text TEXT,
  currency TEXT DEFAULT 'RUB'
);

CREATE TABLE IF NOT EXISTS saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  ingredients JSONB DEFAULT '[]'::jsonb,
  steps JSONB DEFAULT '[]'::jsonb,
  icon TEXT DEFAULT '🍳',
  source TEXT DEFAULT 'ai',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_tgid_month ON budgets(telegram_user_id, month);
CREATE INDEX IF NOT EXISTS idx_receipts_tgid ON receipts(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_tgid ON saved_recipes(telegram_user_id);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_all" ON budgets FOR ALL USING (true);
CREATE POLICY "receipts_all" ON receipts FOR ALL USING (true);
CREATE POLICY "saved_recipes_all" ON saved_recipes FOR ALL USING (true);

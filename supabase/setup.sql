-- EatSave — Supabase full setup
-- Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (IF NOT EXISTS)

-- Core tables
CREATE TABLE IF NOT EXISTS fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  quantity TEXT,
  expiry_date DATE NOT NULL,
  price NUMERIC(10,2) DEFAULT 0,
  icon TEXT DEFAULT '📦',
  telegram_user_id BIGINT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT DEFAULT '🛒',
  currency TEXT DEFAULT 'RUB',
  telegram_user_id BIGINT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_chat_id BIGINT,
  first_name TEXT,
  username TEXT,
  is_premium BOOLEAN DEFAULT false,
  premium_until TIMESTAMPTZ,
  notifications_enabled BOOLEAN DEFAULT true,
  scans_month TEXT,
  scans_this_month INT DEFAULT 0,
  ai_recipes_month TEXT,
  ai_recipes_this_month INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- ─── Extra columns (safe) ───────────────────────────────────
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'RUB';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID;

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_fridge_items_tgid ON fridge_items(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tgid ON expenses(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_tgid_month ON budgets(telegram_user_id, month);
CREATE INDEX IF NOT EXISTS idx_receipts_tgid ON receipts(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_tgid ON saved_recipes(telegram_user_id);

-- ─── RLS (open for Mini App — filtered by telegram_user_id in app) ───
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_all" ON users;
DROP POLICY IF EXISTS "fridge_all" ON fridge_items;
DROP POLICY IF EXISTS "expenses_all" ON expenses;
DROP POLICY IF EXISTS "budgets_all" ON budgets;
DROP POLICY IF EXISTS "receipts_all" ON receipts;
DROP POLICY IF EXISTS "saved_recipes_all" ON saved_recipes;

CREATE POLICY "users_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "fridge_all" ON fridge_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "expenses_all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "budgets_all" ON budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "receipts_all" ON receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "saved_recipes_all" ON saved_recipes FOR ALL USING (true) WITH CHECK (true);

-- ─── Notification helper ─────────────────────────────────────
CREATE OR REPLACE FUNCTION get_expiring_items(target_date DATE)
RETURNS TABLE(user_telegram_id BIGINT, first_name TEXT, item_name TEXT, expiry_date DATE, days_left INT, chat_id BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.telegram_user_id,
    u.first_name,
    f.name,
    f.expiry_date,
    (f.expiry_date - CURRENT_DATE)::INT AS days_left,
    u.telegram_chat_id
  FROM fridge_items f
  JOIN users u ON f.telegram_user_id = u.telegram_user_id
  WHERE f.expiry_date = target_date
    AND u.notifications_enabled = true
    AND u.telegram_chat_id IS NOT NULL;
END;
$$;

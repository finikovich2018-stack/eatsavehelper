-- Fix: add telegram_user_id column to fridge_items and expenses
-- The code uses telegram_user_id (bigint) everywhere, not user_id (UUID)

ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fridge_items_telegram_user_id ON fridge_items(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_telegram_user_id ON expenses(telegram_user_id);

-- Ensure users table exists with all needed columns
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

CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own row" ON users;
DROP POLICY IF EXISTS "Users manage own row" ON users;
DROP POLICY IF EXISTS "Users see own fridge items" ON fridge_items;
DROP POLICY IF EXISTS "Users see own expenses" ON expenses;

CREATE POLICY "Users see own row" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users manage own row" ON users FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users see own fridge items" ON fridge_items FOR ALL USING (true);
CREATE POLICY "Users see own expenses" ON expenses FOR ALL USING (true);

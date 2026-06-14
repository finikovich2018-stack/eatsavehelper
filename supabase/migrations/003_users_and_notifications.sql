-- Users table for Telegram auth + preferences
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

-- Index for fast lookup by telegram ID
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);

-- fridge_items: link to users
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- expenses: link to users
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- RLS: users only see their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own row" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users manage own row" ON users FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users see own fridge items" ON fridge_items FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users see own expenses" ON expenses FOR ALL USING (user_id = auth.uid());

-- Function: get products expiring tomorrow (for notifications)
CREATE OR REPLACE FUNCTION get_expiring_items(target_date DATE)
RETURNS TABLE(user_telegram_id BIGINT, first_name TEXT, item_name TEXT, expiry_date DATE, days_left INT, chat_id BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  JOIN users u ON f.user_id = u.id
  WHERE f.expiry_date = target_date
    AND u.notifications_enabled = true
    AND u.telegram_chat_id IS NOT NULL;
END;
$$;

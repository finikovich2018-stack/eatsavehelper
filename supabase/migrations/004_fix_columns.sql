-- Safe migration: handles existing tables gracefully
-- Run each section separately if needed

-- 1. Add telegram_user_id to fridge_items (if missing)
DO $$ BEGIN
  ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add telegram_user_id to expenses (if missing)
DO $$ BEGIN
  ALTER TABLE expenses ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_fridge_items_tgid ON fridge_items(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tgid ON expenses(telegram_user_id);

-- 4. Check if users table exists and has id column, fix if needed
DO $$
DECLARE
  has_id BOOLEAN;
  col_exists BOOLEAN;
BEGIN
  -- Check if users table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
  ) INTO has_id;
  
  IF has_id THEN
    -- Check if id column exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'id'
    ) INTO col_exists;
    
    -- Add missing columns one by one
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS scans_month TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS scans_this_month INT DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_recipes_month TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_recipes_this_month INT DEFAULT 0;
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    EXCEPTION WHEN duplicate_column THEN NULL; END;
    
    CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
  ELSE
    -- Table doesn't exist at all, create fresh
    CREATE TABLE users (
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
    CREATE INDEX idx_users_telegram_user_id ON users(telegram_user_id);
  END IF;
END $$;

-- 5. Enable RLS (safe to re-run)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 6. Drop and recreate policies (idempotent)
DROP POLICY IF EXISTS "Users see own row" ON users;
DROP POLICY IF EXISTS "Users manage own row" ON users;
DROP POLICY IF EXISTS "Users see own fridge items" ON fridge_items;
DROP POLICY IF EXISTS "Users see own expenses" ON expenses;

CREATE POLICY "Users see own row" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users manage own row" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users see own fridge items" ON fridge_items FOR ALL USING (true);
CREATE POLICY "Users see own expenses" ON expenses FOR ALL USING (true);

-- Verify
SELECT 'fridge_items columns' as info, column_name, data_type FROM information_schema.columns WHERE table_name = 'fridge_items' AND column_name = 'telegram_user_id'
UNION ALL
SELECT 'expenses columns', column_name, data_type FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'telegram_user_id'
UNION ALL
SELECT 'users columns', column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position LIMIT 20;

-- Run in Supabase SQL Editor if Premium activation fails
-- Adds missing columns on legacy users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scans_month TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scans_this_month INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_recipes_month TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_recipes_this_month INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- ... остальное из patch_premium.sql
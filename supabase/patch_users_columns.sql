-- Run once in Supabase SQL Editor so admin shows user names
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Achievement bonus: run supabase/patch_achievements.sql for monthly Premium reward

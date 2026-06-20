-- Achievement monthly bonus tracking (run once in Supabase SQL Editor)
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievement_bonus_month TEXT;

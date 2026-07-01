-- Fridge consumption log: track products eaten vs wasted.
-- Powers the "Съел / Выбросил" quick actions and monthly savings stats.
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS fridge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  household_id UUID,
  name TEXT,
  category TEXT,
  action TEXT NOT NULL CHECK (action IN ('eaten', 'wasted')),
  logged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fridge_log_tgid ON fridge_log(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_fridge_log_household ON fridge_log(household_id);
CREATE INDEX IF NOT EXISTS idx_fridge_log_logged_at ON fridge_log(logged_at);

ALTER TABLE fridge_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fridge_log_all" ON fridge_log;
CREATE POLICY "fridge_log_all" ON fridge_log FOR ALL USING (true) WITH CHECK (true);

-- Family / household sharing (run once in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_telegram_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (household_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS household_id UUID;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS household_id UUID;

CREATE INDEX IF NOT EXISTS idx_household_members_tgid ON household_members(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_hid ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_fridge_household ON fridge_items(household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_household ON expenses(household_id);
CREATE INDEX IF NOT EXISTS idx_budgets_household ON budgets(household_id);
CREATE INDEX IF NOT EXISTS idx_receipts_household ON receipts(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_household ON shopping_list_items(household_id);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_households" ON households;
DROP POLICY IF EXISTS "deny_anon_household_members" ON household_members;
DROP POLICY IF EXISTS "deny_anon_household_invites" ON household_invites;

CREATE POLICY "deny_anon_households" ON households FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_household_members" ON household_members FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_household_invites" ON household_invites FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

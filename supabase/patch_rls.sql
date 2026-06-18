-- EatSave RLS lockdown — run in Supabase SQL Editor AFTER deploying API routes
-- Service role (server) bypasses RLS; anon key can no longer read/write user data directly.

DROP POLICY IF EXISTS "users_all" ON users;
DROP POLICY IF EXISTS "fridge_all" ON fridge_items;
DROP POLICY IF EXISTS "expenses_all" ON expenses;
DROP POLICY IF EXISTS "budgets_all" ON budgets;
DROP POLICY IF EXISTS "receipts_all" ON receipts;
DROP POLICY IF EXISTS "saved_recipes_all" ON saved_recipes;
DROP POLICY IF EXISTS "deny_anon_users" ON users;
DROP POLICY IF EXISTS "deny_anon_fridge" ON fridge_items;
DROP POLICY IF EXISTS "deny_anon_expenses" ON expenses;
DROP POLICY IF EXISTS "deny_anon_budgets" ON budgets;
DROP POLICY IF EXISTS "deny_anon_receipts" ON receipts;
DROP POLICY IF EXISTS "deny_anon_recipes" ON saved_recipes;
DROP POLICY IF EXISTS "deny_anon_payments" ON premium_payments;

CREATE POLICY "deny_anon_users" ON users FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_fridge" ON fridge_items FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_expenses" ON expenses FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_budgets" ON budgets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_receipts" ON receipts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_anon_recipes" ON saved_recipes FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- premium_payments table (if not exists yet)
CREATE TABLE IF NOT EXISTS premium_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  telegram_payment_charge_id TEXT,
  amount INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XTR',
  invoice_payload TEXT,
  activated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_payments_user ON premium_payments(telegram_user_id, created_at DESC);

ALTER TABLE premium_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_anon_payments" ON premium_payments FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

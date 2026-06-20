-- Shopping list (run once in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  checked BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual',
  fridge_item_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_tgid ON shopping_list_items(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_tgid_checked ON shopping_list_items(telegram_user_id, checked);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_anon_shopping" ON shopping_list_items;
CREATE POLICY "deny_anon_shopping" ON shopping_list_items FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

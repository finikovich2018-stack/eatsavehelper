-- ─── Track money lost on wasted food ───────────────────────
-- fridge_items already has a `price` column; add currency so we can
-- format the sum correctly. fridge_log stores a snapshot of the
-- price/currency at the moment an item is consumed or thrown away.

ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE fridge_log   ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE fridge_log   ADD COLUMN IF NOT EXISTS currency TEXT;

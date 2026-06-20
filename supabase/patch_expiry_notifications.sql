-- Fix expiry notifications: notify all household members + fallback for solo users
-- Run once in Supabase SQL Editor (after patch_household.sql)

CREATE OR REPLACE FUNCTION get_expiring_items(target_date DATE)
RETURNS TABLE(
  user_telegram_id BIGINT,
  first_name TEXT,
  item_name TEXT,
  expiry_date DATE,
  days_left INT,
  chat_id BIGINT
)
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
  JOIN users u ON (
    (f.household_id IS NOT NULL AND u.household_id = f.household_id)
    OR (f.household_id IS NULL AND f.telegram_user_id = u.telegram_user_id)
  )
  WHERE f.expiry_date = target_date
    AND u.notifications_enabled = true
    AND u.telegram_chat_id IS NOT NULL;
END;
$$;

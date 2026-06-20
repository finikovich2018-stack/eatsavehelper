-- Daily food reminders: expiring tomorrow, expired, shopping list
-- Run once in Supabase SQL Editor (after patch_household.sql + patch_shopping_list.sql)

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

CREATE OR REPLACE FUNCTION get_expired_items(max_days INT DEFAULT 7)
RETURNS TABLE(
  user_telegram_id BIGINT,
  first_name TEXT,
  item_name TEXT,
  expiry_date DATE,
  days_overdue INT,
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
    (CURRENT_DATE - f.expiry_date)::INT AS days_overdue,
    u.telegram_chat_id
  FROM fridge_items f
  JOIN users u ON (
    (f.household_id IS NOT NULL AND u.household_id = f.household_id)
    OR (f.household_id IS NULL AND f.telegram_user_id = u.telegram_user_id)
  )
  WHERE f.expiry_date < CURRENT_DATE
    AND f.expiry_date >= CURRENT_DATE - max_days
    AND u.notifications_enabled = true
    AND u.telegram_chat_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION get_shopping_reminders()
RETURNS TABLE(
  user_telegram_id BIGINT,
  first_name TEXT,
  item_name TEXT,
  quantity TEXT,
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
    s.name,
    s.quantity,
    u.telegram_chat_id
  FROM shopping_list_items s
  JOIN users u ON (
    (s.household_id IS NOT NULL AND u.household_id = s.household_id)
    OR (s.household_id IS NULL AND s.telegram_user_id = u.telegram_user_id)
  )
  WHERE s.checked = false
    AND u.notifications_enabled = true
    AND u.telegram_chat_id IS NOT NULL;
END;
$$;

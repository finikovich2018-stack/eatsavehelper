-- Per-type notification toggles + exact-hour matching for hourly cron.
-- Run once in Supabase SQL Editor (after patch_expiring_soon_notify.sql).

ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_shopping BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_expiring BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_expired BOOLEAN DEFAULT true;

UPDATE users SET notify_shopping = true WHERE notify_shopping IS NULL;
UPDATE users SET notify_expiring = true WHERE notify_expiring IS NULL;
UPDATE users SET notify_expired = true WHERE notify_expired IS NULL;

-- Exact local hour (hourly cron at :00) + at most once per local day.
CREATE OR REPLACE FUNCTION user_reminder_due(
  tz TEXT,
  hour_pref INT,
  last_sent DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(NULLIF(btrim(tz), ''), 'Europe/Moscow')))::INT
      = COALESCE(hour_pref, 12)
    AND (
      last_sent IS NULL
      OR last_sent <> (now() AT TIME ZONE COALESCE(NULLIF(btrim(tz), ''), 'Europe/Moscow'))::date
    );
$$;

CREATE OR REPLACE FUNCTION get_expiring_items(max_days INT DEFAULT 3)
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
  WHERE f.expiry_date >= CURRENT_DATE
    AND f.expiry_date <= CURRENT_DATE + max_days
    AND u.notifications_enabled = true
    AND COALESCE(u.notify_expiring, true) = true
    AND u.telegram_chat_id IS NOT NULL
    AND user_reminder_due(u.timezone, u.notify_hour, u.last_reminder_date);
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
    AND COALESCE(u.notify_expired, true) = true
    AND u.telegram_chat_id IS NOT NULL
    AND user_reminder_due(u.timezone, u.notify_hour, u.last_reminder_date);
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
    AND COALESCE(u.notify_shopping, true) = true
    AND u.telegram_chat_id IS NOT NULL
    AND user_reminder_due(u.timezone, u.notify_hour, u.last_reminder_date);
END;
$$;

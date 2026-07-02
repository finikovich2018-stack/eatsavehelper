-- Expiring-soon notifications: match the app (≤3 days) + catch-up if the exact hour was missed.
-- Run once in Supabase SQL Editor (after patch_notify_time.sql).

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
      >= COALESCE(hour_pref, 12)
    AND (
      last_sent IS NULL
      OR last_sent <> (now() AT TIME ZONE COALESCE(NULLIF(btrim(tz), ''), 'Europe/Moscow'))::date
    );
$$;

-- Items expiring within max_days (0 = today … max_days), hour-aware per user.
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
    AND u.telegram_chat_id IS NOT NULL
    AND user_reminder_due(u.timezone, u.notify_hour, u.last_reminder_date);
END;
$$;

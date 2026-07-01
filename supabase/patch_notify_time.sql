-- Per-user notification time.
-- Adds notify_hour / timezone / last_reminder_date to users and makes the
-- reminder functions send only during each user's chosen local hour (once/day).
-- Run once in Supabase SQL Editor (after patch_food_reminders.sql).

-- ─── Columns ────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_hour INT DEFAULT 12;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Moscow';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_reminder_date DATE;

-- Clamp any out-of-range values just in case
UPDATE users SET notify_hour = 12 WHERE notify_hour IS NULL OR notify_hour < 0 OR notify_hour > 23;
UPDATE users SET timezone = 'Europe/Moscow' WHERE timezone IS NULL OR btrim(timezone) = '';

-- ─── Helpers ────────────────────────────────────────────────
-- TRUE when it is currently the user's chosen local hour AND we have not
-- already sent a reminder for the user's current local date.
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

-- ─── Reminder queries (hour-aware) ──────────────────────────
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
    AND u.telegram_chat_id IS NOT NULL
    AND user_reminder_due(u.timezone, u.notify_hour, u.last_reminder_date);
END;
$$;

-- ─── Mark users as reminded for their current local day ─────
CREATE OR REPLACE FUNCTION mark_reminded(user_ids BIGINT[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users
  SET last_reminder_date = (now() AT TIME ZONE COALESCE(NULLIF(btrim(timezone), ''), 'Europe/Moscow'))::date
  WHERE telegram_user_id = ANY(user_ids);
$$;

-- Weekly Telegram digest.
-- Sends a once-a-week recap (eaten / wasted / money lost / spent) on Sunday at
-- each user's chosen local hour. Mirrors the per-user timezone approach used by
-- the daily reminders. Run once in Supabase SQL Editor (after patch_notify_time.sql).

-- ─── Column ──────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_date DATE;

-- ─── Due check ───────────────────────────────────────────────
-- TRUE when it is Sunday, at the user's chosen local hour, and we have not
-- already sent this user's digest for the current local date.
CREATE OR REPLACE FUNCTION user_digest_due(
  tz TEXT,
  hour_pref INT,
  last_sent DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(DOW FROM (now() AT TIME ZONE COALESCE(NULLIF(btrim(tz), ''), 'Europe/Moscow')))::INT = 0
    AND EXTRACT(HOUR FROM (now() AT TIME ZONE COALESCE(NULLIF(btrim(tz), ''), 'Europe/Moscow')))::INT
      = COALESCE(hour_pref, 12)
    AND (
      last_sent IS NULL
      OR last_sent <> (now() AT TIME ZONE COALESCE(NULLIF(btrim(tz), ''), 'Europe/Moscow'))::date
    );
$$;

-- ─── Users due for a digest right now ────────────────────────
CREATE OR REPLACE FUNCTION get_weekly_digest_users()
RETURNS TABLE(
  user_telegram_id BIGINT,
  first_name TEXT,
  chat_id BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT u.telegram_user_id, u.first_name, u.telegram_chat_id
  FROM users u
  WHERE u.notifications_enabled = true
    AND u.telegram_chat_id IS NOT NULL
    AND user_digest_due(u.timezone, u.notify_hour, u.last_digest_date);
$$;

-- ─── Mark users as digested for their current local day ──────
CREATE OR REPLACE FUNCTION mark_digest_sent(user_ids BIGINT[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users
  SET last_digest_date = (now() AT TIME ZONE COALESCE(NULLIF(btrim(timezone), ''), 'Europe/Moscow'))::date
  WHERE telegram_user_id = ANY(user_ids);
$$;

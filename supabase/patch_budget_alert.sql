-- Budget limit alerts: remember the last threshold we notified a user about,
-- so we send the "80% / over budget" Telegram message at most once per month/level.
-- Format stored: "YYYY-MM:80" or "YYYY-MM:100". Run once in Supabase SQL Editor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS budget_alert_state TEXT;

-- Recover data visibility after household migration (run once in Supabase SQL Editor)
-- Links existing rows to the user's household_id from the users table.

UPDATE fridge_items f
SET household_id = u.household_id
FROM users u
WHERE f.telegram_user_id = u.telegram_user_id
  AND f.household_id IS NULL
  AND u.household_id IS NOT NULL;

UPDATE expenses e
SET household_id = u.household_id
FROM users u
WHERE e.telegram_user_id = u.telegram_user_id
  AND e.household_id IS NULL
  AND u.household_id IS NOT NULL;

UPDATE budgets b
SET household_id = u.household_id
FROM users u
WHERE b.telegram_user_id = u.telegram_user_id
  AND b.household_id IS NULL
  AND u.household_id IS NOT NULL;

UPDATE receipts r
SET household_id = u.household_id
FROM users u
WHERE r.telegram_user_id = u.telegram_user_id
  AND r.household_id IS NULL
  AND u.household_id IS NOT NULL;

UPDATE shopping_list_items s
SET household_id = u.household_id
FROM users u
WHERE s.telegram_user_id = u.telegram_user_id
  AND s.household_id IS NULL
  AND u.household_id IS NOT NULL;

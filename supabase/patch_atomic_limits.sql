-- Atomic limits: referral claims, household joins, fridge capacity
-- Run once in Supabase SQL Editor after patch_household.sql and patch_referrals.sql

-- Referral: insert row first, then app grants Premium (prevents double-claim races)
CREATE OR REPLACE FUNCTION claim_referral_reward(
  p_referee_id BIGINT,
  p_referral_code TEXT,
  p_bonus_days INT,
  p_milestone_size INT,
  p_milestone_bonus_days INT,
  p_max_monthly INT,
  p_new_user_hours INT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_referrer_id BIGINT;
  v_referee RECORD;
  v_month_count INT;
  v_total_invited INT;
  v_milestone_days INT;
  v_hours NUMERIC;
BEGIN
  SELECT telegram_user_id INTO v_referrer_id
  FROM users
  WHERE referral_code = p_referral_code;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Referral link not found';
  END IF;

  IF v_referrer_id = p_referee_id THEN
    RAISE EXCEPTION 'Cannot use your own link';
  END IF;

  SELECT * INTO v_referee
  FROM users
  WHERE telegram_user_id = p_referee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_referee.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'alreadyClaimed', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM referrals WHERE referee_telegram_user_id = p_referee_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'alreadyClaimed', true);
  END IF;

  v_hours := EXTRACT(EPOCH FROM (now() - COALESCE(v_referee.created_at, now()))) / 3600;
  IF v_hours > p_new_user_hours THEN
    RAISE EXCEPTION 'Referral only for new users';
  END IF;

  SELECT COUNT(*)::INT INTO v_month_count
  FROM referrals
  WHERE referrer_telegram_user_id = v_referrer_id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC');

  IF v_month_count >= p_max_monthly THEN
    RAISE EXCEPTION 'Referrer monthly limit reached';
  END IF;

  SELECT COUNT(*)::INT INTO v_total_invited
  FROM referrals
  WHERE referrer_telegram_user_id = v_referrer_id;

  v_milestone_days := CASE
    WHEN (v_total_invited + 1) % p_milestone_size = 0 THEN p_milestone_bonus_days
    ELSE 0
  END;

  INSERT INTO referrals (
    referrer_telegram_user_id,
    referee_telegram_user_id,
    reward_days,
    rewarded_at
  ) VALUES (
    v_referrer_id,
    p_referee_id,
    p_bonus_days,
    now()
  );

  UPDATE users
  SET referred_by = v_referrer_id
  WHERE telegram_user_id = p_referee_id;

  RETURN jsonb_build_object(
    'ok', true,
    'referrerId', v_referrer_id,
    'bonusDays', p_bonus_days,
    'milestoneDays', v_milestone_days
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'alreadyClaimed', true);
END;
$$;

-- Household join with row lock (prevents exceeding MAX_HOUSEHOLD_MEMBERS)
CREATE OR REPLACE FUNCTION join_household_member(
  p_user_id BIGINT,
  p_household_id UUID,
  p_max_members INT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM 1 FROM households WHERE id = p_household_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id AND telegram_user_id = p_user_id
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM household_members
  WHERE household_id = p_household_id;

  IF v_count >= p_max_members THEN
    RAISE EXCEPTION 'household_full';
  END IF;

  INSERT INTO household_members (household_id, telegram_user_id, role)
  VALUES (p_household_id, p_user_id, 'member');

  SELECT COUNT(*)::INT INTO v_count
  FROM household_members
  WHERE household_id = p_household_id;

  IF v_count > p_max_members THEN
    RAISE EXCEPTION 'household_full';
  END IF;
END;
$$;

-- Fridge capacity check under household or solo scope
CREATE OR REPLACE FUNCTION assert_fridge_capacity(
  p_household_id UUID,
  p_user_id BIGINT,
  p_add_count INT,
  p_limit INT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_add_count <= 0 THEN
    RETURN;
  END IF;

  IF p_household_id IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_count
    FROM fridge_items
    WHERE household_id = p_household_id;
  ELSE
    SELECT COUNT(*)::INT INTO v_count
    FROM fridge_items
    WHERE telegram_user_id = p_user_id
      AND household_id IS NULL;
  END IF;

  IF v_count + p_add_count > p_limit THEN
    RAISE EXCEPTION 'fridge_limit';
  END IF;
END;
$$;

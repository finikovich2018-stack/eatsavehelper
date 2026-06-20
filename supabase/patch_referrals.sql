-- Referral program: invite a friend -> +3 days Premium for referrer
-- Run once in Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_telegram_user_id BIGINT NOT NULL,
  referee_telegram_user_id BIGINT NOT NULL UNIQUE,
  reward_days INT NOT NULL DEFAULT 3,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(referrer_telegram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

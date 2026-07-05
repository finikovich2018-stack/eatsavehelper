-- Idempotent Stars payments (Telegram may retry successful_payment webhook)
ALTER TABLE premium_payments ADD COLUMN IF NOT EXISTS telegram_payment_charge_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_payments_charge_id
  ON premium_payments (telegram_payment_charge_id)
  WHERE telegram_payment_charge_id IS NOT NULL;

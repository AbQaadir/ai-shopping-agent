-- Add phaseRetryCount to CheckoutSession for harness contract retry tracking
ALTER TABLE "CheckoutSession"
  ADD COLUMN IF NOT EXISTS "phaseRetryCount" INTEGER NOT NULL DEFAULT 0;

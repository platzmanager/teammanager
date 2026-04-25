-- Add 'yearly' billing interval to meal_settings
ALTER TABLE meal_settings
  DROP CONSTRAINT IF EXISTS meal_settings_billing_interval_check;

ALTER TABLE meal_settings
  ADD CONSTRAINT meal_settings_billing_interval_check
  CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly', 'seasonal'));

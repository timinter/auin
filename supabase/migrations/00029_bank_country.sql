-- Add bank_country to profiles for tax rate mapping
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_country text;

-- Default tax rate mapping:
-- Belarus (AMC) → 14%
-- USA (Zepter) → 11.5%
-- UAE → 0%
-- Georgia → 1%
-- The tax_rate column already exists; bank_country drives auto-calculation.

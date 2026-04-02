-- Add note field to compensations (like bonus_note for bonuses)
ALTER TABLE employee_compensations ADD COLUMN IF NOT EXISTS note text;

-- Allow category_id to be null for custom/ad-hoc compensations
ALTER TABLE employee_compensations ALTER COLUMN category_id DROP NOT NULL;

-- Consolidate four bonus columns into a single "bonus" column.
-- Migrate existing data by summing all bonus values.

ALTER TABLE payroll_records
  ADD COLUMN bonus numeric(12,2) NOT NULL DEFAULT 0;

-- Migrate existing bonus data
UPDATE payroll_records
SET bonus = bonus_delivery_overtime + bonus_leadgen + bonus_recruiting + bonus_arbitrary;

-- Rename bonus_arbitrary_note → bonus_note
ALTER TABLE payroll_records
  RENAME COLUMN bonus_arbitrary_note TO bonus_note;

-- Drop old columns
ALTER TABLE payroll_records
  DROP COLUMN bonus_delivery_overtime,
  DROP COLUMN bonus_leadgen,
  DROP COLUMN bonus_recruiting,
  DROP COLUMN bonus_arbitrary;

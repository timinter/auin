-- Add adjustment fields to payroll_records for admin deductions/additions with reasons
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS adjustment_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS adjustment_reason text;

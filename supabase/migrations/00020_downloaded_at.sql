-- Add downloaded_at timestamp to payroll_records and freelancer_invoices
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS downloaded_at timestamptz;
ALTER TABLE freelancer_invoices ADD COLUMN IF NOT EXISTS downloaded_at timestamptz;

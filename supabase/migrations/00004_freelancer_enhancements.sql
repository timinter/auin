-- Phase 3: Freelancer Enhancements
-- 3.1 Payment method expansion
-- 3.3 Time report upload
-- 3.4 Submission & payment deadlines
-- 3.6 Bonus line items

-- 3.1: Expand payment_channel to include freelancer payment methods
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_payment_channel_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_payment_channel_check
  CHECK (payment_channel IN ('AMC', 'Interexy', 'CRYPTO', 'BANK', 'PAYONEER'));

-- 3.3: Add time report URL to freelancer invoices
ALTER TABLE freelancer_invoices ADD COLUMN time_report_url text;

-- 3.4: Add deadlines to payroll periods
ALTER TABLE payroll_periods ADD COLUMN submission_deadline date;
ALTER TABLE payroll_periods ADD COLUMN payment_deadline date;

-- 3.4: Add deadline override per freelancer invoice
ALTER TABLE freelancer_invoices ADD COLUMN deadline_override boolean NOT NULL DEFAULT false;

-- 3.6: Add line_type and description to freelancer invoice lines
ALTER TABLE freelancer_invoice_lines ADD COLUMN line_type text NOT NULL DEFAULT 'project'
  CHECK (line_type IN ('project', 'bonus'));
ALTER TABLE freelancer_invoice_lines ADD COLUMN description text;

-- 3.6: Make project_id nullable for bonus lines
ALTER TABLE freelancer_invoice_lines ALTER COLUMN project_id DROP NOT NULL;

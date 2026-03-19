-- Add BYN amount and receipt date fields to employee compensations
ALTER TABLE public.employee_compensations
  ADD COLUMN IF NOT EXISTS submitted_currency text NOT NULL DEFAULT 'BYN',
  ADD COLUMN IF NOT EXISTS receipt_date date;

-- Rename submitted_amount to clarify it's in original currency
COMMENT ON COLUMN public.employee_compensations.submitted_amount IS 'Amount in submitted_currency (e.g. BYN)';
COMMENT ON COLUMN public.employee_compensations.approved_amount IS 'Final approved amount in USD (gross)';

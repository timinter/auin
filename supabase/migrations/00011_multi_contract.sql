-- Phase 8: Multi-Contract & Advanced
-- Adds support for multiple simultaneous contracts, contract types,
-- notes, and a payroll_records → contract link for audit trail.

-- 1. Add contract_type and notes to employee_contracts
ALTER TABLE public.employee_contracts
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'primary'
    CHECK (contract_type IN ('primary', 'amendment', 'bonus', 'part_time')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS terminated_at date,
  ADD COLUMN IF NOT EXISTS terminated_by uuid REFERENCES public.profiles ON DELETE SET NULL;

-- 2. Add contract_id reference to payroll_records for audit trail
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.employee_contracts ON DELETE SET NULL;

-- 3. Create index for faster contract lookups
CREATE INDEX IF NOT EXISTS idx_employee_contracts_type
  ON public.employee_contracts (contract_type);

CREATE INDEX IF NOT EXISTS idx_employee_contracts_active
  ON public.employee_contracts (employee_id, effective_from, effective_to)
  WHERE effective_to IS NULL AND terminated_at IS NULL;

-- 4. Create a view for "active contracts" (not ended, not terminated)
CREATE OR REPLACE VIEW public.active_contracts AS
SELECT *
FROM public.employee_contracts
WHERE effective_to IS NULL
  AND terminated_at IS NULL;

-- 5. Add submission_deadline and payment_deadline to payroll_periods if missing
ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS submission_deadline date,
  ADD COLUMN IF NOT EXISTS payment_deadline date;

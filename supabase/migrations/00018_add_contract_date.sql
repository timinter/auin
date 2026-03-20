-- Add contract date field to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_date date;

COMMENT ON COLUMN public.profiles.contract_date IS 'Date of the contract (Dated field on invoices)';

-- Add per-employee tax rate for compensation gross-up calculation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,4) NOT NULL DEFAULT 0.13;

COMMENT ON COLUMN public.profiles.tax_rate IS 'Individual income tax rate for gross-up (e.g. 0.13 = 13%)';

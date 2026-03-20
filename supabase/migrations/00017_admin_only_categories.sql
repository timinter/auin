-- Add admin_only flag to compensation categories
ALTER TABLE public.compensation_categories
  ADD COLUMN IF NOT EXISTS admin_only boolean NOT NULL DEFAULT false;

-- Birthday and English are admin-only (not submittable by employees)
UPDATE public.compensation_categories SET admin_only = true WHERE name IN ('birthday', 'english');

-- Freelancer legal entity support
-- Freelancers can be individuals or legal entities (ЮР лица)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS freelancer_type text DEFAULT 'individual'
  CHECK (freelancer_type IN ('individual', 'legal_entity'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_number text; -- УНП / ИНН
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signatory_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signatory_position text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_vat_payer boolean DEFAULT false;

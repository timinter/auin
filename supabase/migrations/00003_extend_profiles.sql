-- Extend profiles with new fields for Phase 1.2

-- Contract start date
ALTER TABLE profiles ADD COLUMN contract_start_date date;

-- Legal address (personal)
ALTER TABLE profiles ADD COLUMN legal_address text;

-- Personal email (separate from auth email)
ALTER TABLE profiles ADD COLUMN personal_email text;

-- Service description (as per contract, used on invoices)
ALTER TABLE profiles ADD COLUMN service_description text;

-- Custom invoice numbering
ALTER TABLE profiles ADD COLUMN invoice_number_prefix text;
ALTER TABLE profiles ADD COLUMN invoice_number_seq integer NOT NULL DEFAULT 1;

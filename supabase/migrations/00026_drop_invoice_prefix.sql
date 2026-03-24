-- Drop invoice_number_prefix column — invoices now always use "N{seq}" format
ALTER TABLE profiles DROP COLUMN IF EXISTS invoice_number_prefix;

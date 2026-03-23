-- ============================================================
-- 1. bank_accounts table (replaces payment_splits for profile-level bank storage)
-- ============================================================

CREATE TABLE public.bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label           text NOT NULL,
  bank_name       text NOT NULL DEFAULT '',
  account_number  text NOT NULL DEFAULT '',
  swift           text NOT NULL DEFAULT '',
  iban            text NOT NULL DEFAULT '',
  routing_number  text NOT NULL DEFAULT '',
  bank_address    text NOT NULL DEFAULT '',
  is_primary      boolean NOT NULL DEFAULT false,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one primary bank account per profile
CREATE UNIQUE INDEX idx_bank_accounts_primary
  ON public.bank_accounts(profile_id) WHERE is_primary = true;

CREATE INDEX idx_bank_accounts_profile
  ON public.bank_accounts(profile_id);

-- RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank accounts"
  ON public.bank_accounts FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Admins can manage all bank accounts"
  ON public.bank_accounts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 2. payroll_payment_splits table (per payroll record, amount-based)
-- ============================================================

CREATE TABLE public.payroll_payment_splits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_record_id   uuid NOT NULL REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  bank_account_id     uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payroll_splits_record
  ON public.payroll_payment_splits(payroll_record_id);

-- RLS
ALTER TABLE public.payroll_payment_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payroll splits"
  ON public.payroll_payment_splits FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own payroll splits"
  ON public.payroll_payment_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_records pr
      WHERE pr.id = payroll_record_id AND pr.employee_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Migrate existing bank_details from profiles into bank_accounts
-- ============================================================

INSERT INTO public.bank_accounts (profile_id, label, bank_name, account_number, swift, iban, routing_number, bank_address, is_primary)
SELECT
  id,
  'Primary Bank',
  COALESCE(bank_details->>'bank_name', ''),
  COALESCE(bank_details->>'account_number', ''),
  COALESCE(bank_details->>'swift', ''),
  COALESCE(bank_details->>'iban', ''),
  COALESCE(bank_details->>'routing_number', ''),
  COALESCE(bank_details->>'bank_address', ''),
  true
FROM public.profiles
WHERE bank_details IS NOT NULL
  AND bank_details != '{}'::jsonb
  AND bank_details != 'null'::jsonb;

-- ============================================================
-- 4. Drop old payment_splits table
-- ============================================================

DROP TABLE IF EXISTS public.payment_splits;

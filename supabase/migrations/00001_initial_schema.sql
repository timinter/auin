-- SAMAP Invoice Automation Platform — Initial Schema
-- Supabase (PostgreSQL) migration

-- ============================================================
-- 0. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Tables
-- ============================================================

-- 2.1 profiles
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       text UNIQUE NOT NULL,
  first_name  text NOT NULL DEFAULT '',
  last_name   text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'employee'
              CHECK (role IN ('admin','employee','freelancer')),
  department  text CHECK (department IN ('Delivery','HR','Marketing','Sales','Leadgen','Administrative')),
  status      text NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','inactive')),
  payment_channel text CHECK (payment_channel IN ('AMC','Interexy','CRYPTO')),
  currency    text NOT NULL DEFAULT 'USD',
  bank_details jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2.2 invitations
CREATE TABLE public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin','employee','freelancer')),
  token       text UNIQUE NOT NULL,
  invited_by  uuid REFERENCES public.profiles ON DELETE SET NULL,
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2.3 employee_contracts
CREATE TABLE public.employee_contracts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  gross_salary   numeric(12,2) NOT NULL,
  currency       text NOT NULL DEFAULT 'USD',
  effective_from date NOT NULL,
  effective_to   date,
  created_by     uuid REFERENCES public.profiles ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2.4 payroll_periods
CREATE TABLE public.payroll_periods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year         int NOT NULL,
  month        int NOT NULL CHECK (month BETWEEN 1 AND 12),
  working_days int NOT NULL CHECK (working_days > 0),
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','locked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

-- 2.5 payroll_records
CREATE TABLE public.payroll_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id               uuid NOT NULL REFERENCES public.payroll_periods ON DELETE CASCADE,
  employee_id             uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  days_worked             int NOT NULL DEFAULT 0,
  gross_salary            numeric(12,2) NOT NULL DEFAULT 0,
  prorated_gross          numeric(12,2) NOT NULL DEFAULT 0,
  bonus_delivery_overtime numeric(12,2) NOT NULL DEFAULT 0,
  bonus_leadgen           numeric(12,2) NOT NULL DEFAULT 0,
  bonus_recruiting        numeric(12,2) NOT NULL DEFAULT 0,
  bonus_arbitrary         numeric(12,2) NOT NULL DEFAULT 0,
  bonus_arbitrary_note    text,
  compensation_amount     numeric(12,2) NOT NULL DEFAULT 0,
  total_amount            numeric(12,2) NOT NULL DEFAULT 0,
  status                  text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','pending_approval','approved','rejected')),
  rejection_reason        text,
  invoice_file_url        text,
  invoice_drive_file_id   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);

-- 2.6 projects
CREATE TABLE public.projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2.7 freelancer_project_rates
CREATE TABLE public.freelancer_project_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id  uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  hourly_rate    numeric(10,2) NOT NULL,
  currency       text NOT NULL DEFAULT 'USD',
  effective_from date NOT NULL,
  effective_to   date,
  created_by     uuid REFERENCES public.profiles ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2.8 freelancer_invoices
CREATE TABLE public.freelancer_invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id             uuid NOT NULL REFERENCES public.payroll_periods ON DELETE CASCADE,
  freelancer_id         uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  total_amount          numeric(12,2) NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','pending_approval','approved','rejected')),
  rejection_reason      text,
  invoice_file_url      text,
  invoice_drive_file_id text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, freelancer_id)
);

-- 2.9 freelancer_invoice_lines
CREATE TABLE public.freelancer_invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.freelancer_invoices ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects ON DELETE CASCADE,
  hours       numeric(6,2) NOT NULL DEFAULT 0,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  line_total  numeric(12,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2.10 audit_log
CREATE TABLE public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  old_values  jsonb,
  new_values  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Helper: get current user's role (after tables exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 3. Triggers: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payroll_records_updated_at
  BEFORE UPDATE ON public.payroll_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_freelancer_invoices_updated_at
  BEFORE UPDATE ON public.freelancer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. Trigger: auto-create profile on auth sign-up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. Indexes
-- ============================================================
CREATE INDEX idx_profiles_email ON public.profiles (email);
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_status ON public.profiles (status);

CREATE INDEX idx_invitations_token ON public.invitations (token);
CREATE INDEX idx_invitations_email ON public.invitations (email);

CREATE INDEX idx_employee_contracts_employee ON public.employee_contracts (employee_id);
CREATE INDEX idx_employee_contracts_dates ON public.employee_contracts (effective_from, effective_to);

CREATE INDEX idx_payroll_periods_year_month ON public.payroll_periods (year, month);

CREATE INDEX idx_payroll_records_period ON public.payroll_records (period_id);
CREATE INDEX idx_payroll_records_employee ON public.payroll_records (employee_id);
CREATE INDEX idx_payroll_records_status ON public.payroll_records (status);

CREATE INDEX idx_freelancer_project_rates_freelancer ON public.freelancer_project_rates (freelancer_id);
CREATE INDEX idx_freelancer_project_rates_project ON public.freelancer_project_rates (project_id);

CREATE INDEX idx_freelancer_invoices_period ON public.freelancer_invoices (period_id);
CREATE INDEX idx_freelancer_invoices_freelancer ON public.freelancer_invoices (freelancer_id);
CREATE INDEX idx_freelancer_invoices_status ON public.freelancer_invoices (status);

CREATE INDEX idx_freelancer_invoice_lines_invoice ON public.freelancer_invoice_lines (invoice_id);

CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);

-- ============================================================
-- 6. Row-Level Security
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_project_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Users can update own bank_details"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---- invitations ----
CREATE POLICY "Admins can manage invitations"
  ON public.invitations FOR ALL
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Anyone can read invitation by token"
  ON public.invitations FOR SELECT
  USING (true);

-- ---- employee_contracts ----
CREATE POLICY "Employees can read own contracts"
  ON public.employee_contracts FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Admins can manage all contracts"
  ON public.employee_contracts FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- payroll_periods ----
CREATE POLICY "Everyone can read payroll periods"
  ON public.payroll_periods FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage payroll periods"
  ON public.payroll_periods FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- payroll_records ----
CREATE POLICY "Employees can read own payroll records"
  ON public.payroll_records FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can update own payroll status"
  ON public.payroll_records FOR UPDATE
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins can manage all payroll records"
  ON public.payroll_records FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- projects ----
CREATE POLICY "Everyone can read projects"
  ON public.projects FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage projects"
  ON public.projects FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- freelancer_project_rates ----
CREATE POLICY "Freelancers can read own rates"
  ON public.freelancer_project_rates FOR SELECT
  USING (freelancer_id = auth.uid());

CREATE POLICY "Admins can manage all rates"
  ON public.freelancer_project_rates FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- freelancer_invoices ----
CREATE POLICY "Freelancers can read own invoices"
  ON public.freelancer_invoices FOR SELECT
  USING (freelancer_id = auth.uid());

CREATE POLICY "Freelancers can insert own invoices"
  ON public.freelancer_invoices FOR INSERT
  WITH CHECK (freelancer_id = auth.uid());

CREATE POLICY "Freelancers can update own draft invoices"
  ON public.freelancer_invoices FOR UPDATE
  USING (freelancer_id = auth.uid() AND status IN ('draft','rejected'))
  WITH CHECK (freelancer_id = auth.uid());

CREATE POLICY "Admins can manage all freelancer invoices"
  ON public.freelancer_invoices FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- freelancer_invoice_lines ----
CREATE POLICY "Freelancers can read own invoice lines"
  ON public.freelancer_invoice_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freelancer_invoices fi
      WHERE fi.id = invoice_id AND fi.freelancer_id = auth.uid()
    )
  );

CREATE POLICY "Freelancers can manage own draft invoice lines"
  ON public.freelancer_invoice_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.freelancer_invoices fi
      WHERE fi.id = invoice_id
        AND fi.freelancer_id = auth.uid()
        AND fi.status IN ('draft','rejected')
    )
  );

CREATE POLICY "Admins can manage all invoice lines"
  ON public.freelancer_invoice_lines FOR ALL
  USING (public.get_my_role() = 'admin');

-- ---- audit_log ----
CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Service role can insert (no policy needed for service_role, it bypasses RLS)

-- Phase 5: Compensation Rules Engine

-- 5.1: Compensation categories
CREATE TABLE public.compensation_categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  label            text NOT NULL,
  limit_percentage numeric(5,2),        -- e.g. 50 means company pays 50%
  max_gross        numeric(12,2),        -- max per month in gross salary units
  annual_max_gross numeric(12,2),        -- annual cap
  is_prorated      boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.compensation_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read compensation categories"
  ON public.compensation_categories FOR SELECT USING (true);

CREATE POLICY "Admins can manage compensation categories"
  ON public.compensation_categories FOR ALL
  USING (public.get_my_role() = 'admin');

-- Seed default categories
INSERT INTO public.compensation_categories (name, label, limit_percentage, max_gross, annual_max_gross, is_prorated, sort_order)
VALUES
  ('sport', 'Sport', 50, 40, NULL, false, 1),
  ('services', 'Services', 50, 50, NULL, false, 2),
  ('health_insurance', 'Health Insurance', NULL, NULL, 450, true, 3);

-- 5.2: Employee compensations
CREATE TABLE public.employee_compensations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid NOT NULL REFERENCES public.profiles,
  period_id        uuid NOT NULL REFERENCES public.payroll_periods,
  category_id      uuid NOT NULL REFERENCES public.compensation_categories,
  submitted_amount numeric(12,2) NOT NULL,
  approved_amount  numeric(12,2),
  receipt_url      text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_compensations ENABLE ROW LEVEL SECURITY;

-- Employees can read own compensations
CREATE POLICY "Employees can read own compensations"
  ON public.employee_compensations FOR SELECT
  USING (employee_id = auth.uid());

-- Employees can insert own compensations
CREATE POLICY "Employees can insert own compensations"
  ON public.employee_compensations FOR INSERT
  WITH CHECK (employee_id = auth.uid());

-- Employees can update own pending compensations
CREATE POLICY "Employees can update own pending compensations"
  ON public.employee_compensations FOR UPDATE
  USING (employee_id = auth.uid() AND status = 'pending')
  WITH CHECK (employee_id = auth.uid());

-- Employees can delete own pending compensations
CREATE POLICY "Employees can delete own pending compensations"
  ON public.employee_compensations FOR DELETE
  USING (employee_id = auth.uid() AND status = 'pending');

-- Admins can manage all
CREATE POLICY "Admins can manage all compensations"
  ON public.employee_compensations FOR ALL
  USING (public.get_my_role() = 'admin');

-- 5.4: Exchange rates
CREATE TABLE public.exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     uuid NOT NULL REFERENCES public.payroll_periods,
  from_currency text NOT NULL,
  to_currency   text NOT NULL DEFAULT 'USD',
  rate          numeric(12,6) NOT NULL,
  rate_date     date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, from_currency, to_currency)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exchange rates"
  ON public.exchange_rates FOR SELECT USING (true);

CREATE POLICY "Admins can manage exchange rates"
  ON public.exchange_rates FOR ALL
  USING (public.get_my_role() = 'admin');

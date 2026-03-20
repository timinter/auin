-- Corporate holidays table
CREATE TABLE IF NOT EXISTS public.corporate_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.corporate_holidays ENABLE ROW LEVEL SECURITY;

-- Everyone can read holidays
CREATE POLICY "Anyone can read holidays" ON public.corporate_holidays
  FOR SELECT USING (true);

-- Admins can manage holidays
CREATE POLICY "Admins can manage holidays" ON public.corporate_holidays
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

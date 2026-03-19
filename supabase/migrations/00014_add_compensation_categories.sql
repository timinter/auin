-- Add missing compensation categories per requirements
INSERT INTO public.compensation_categories (name, label, limit_percentage, max_gross, annual_max_gross, is_prorated, sort_order)
VALUES
  ('english', 'English Lessons', NULL, NULL, NULL, false, 4),
  ('ai_tools', 'AI Tools', NULL, 50, NULL, false, 5),
  ('birthday', 'Birthday', NULL, 40, NULL, false, 6),
  ('parking', 'Parking', 100, NULL, NULL, false, 7),
  ('agreed_expenses', 'Agreed Expenses', 100, NULL, NULL, false, 8)
ON CONFLICT (name) DO NOTHING;

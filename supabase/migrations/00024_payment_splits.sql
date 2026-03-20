-- Payment splits: employees can split payroll across multiple payment channels
CREATE TABLE IF NOT EXISTS payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_channel text NOT NULL CHECK (payment_channel IN ('AMC', 'Interexy', 'CRYPTO', 'BANK', 'PAYONEER')),
  percentage numeric(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  bank_details jsonb, -- optional override bank details for this split
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE payment_splits ENABLE ROW LEVEL SECURITY;

-- Users can view their own splits
CREATE POLICY "Users view own splits" ON payment_splits
  FOR SELECT USING (profile_id = auth.uid());

-- Users can manage their own splits
CREATE POLICY "Users manage own splits" ON payment_splits
  FOR ALL USING (profile_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins manage all splits" ON payment_splits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_payment_splits_profile ON payment_splits(profile_id);

-- Leave requests table for tracking unpaid/sick/vacation days
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id),
  period_id uuid NOT NULL REFERENCES payroll_periods(id),
  leave_type text NOT NULL CHECK (leave_type IN ('unpaid', 'sick', 'vacation')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count int NOT NULL CHECK (days_count > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- RLS policies
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Employees can read their own leave requests
CREATE POLICY "Employees can view own leaves" ON leave_requests
  FOR SELECT USING (employee_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins manage all leaves" ON leave_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Employees can insert their own requests
CREATE POLICY "Employees can request leaves" ON leave_requests
  FOR INSERT WITH CHECK (employee_id = auth.uid());

-- Index for common queries
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_period ON leave_requests(period_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);

-- PeopleForce integration: store PF employee ID and leave sync metadata

-- Store PeopleForce employee ID for reliable cross-referencing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS peopleforce_id integer;

-- Track leave source (manual vs peopleforce) and external ID for dedup
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS leave_requests_external_id_idx
  ON leave_requests(external_id) WHERE external_id IS NOT NULL;

-- Add day_off leave type (exists in PeopleForce but not in SAMAP)
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('unpaid', 'sick', 'vacation', 'day_off'));

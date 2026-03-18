-- Add entity column to profiles (BY = Belarus/AMC, US = Interexy USA)
ALTER TABLE profiles ADD COLUMN entity TEXT NOT NULL DEFAULT 'US' CHECK (entity IN ('BY', 'US'));

-- Set existing users based on payment_channel
UPDATE profiles SET entity = 'BY' WHERE payment_channel = 'AMC';

-- Add entity column to invitations
ALTER TABLE invitations ADD COLUMN entity TEXT NOT NULL DEFAULT 'US' CHECK (entity IN ('BY', 'US'));

-- Index for filtering by entity
CREATE INDEX idx_profiles_entity ON profiles(entity);

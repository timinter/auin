-- Expand entity options: BY, US -> BY, US, AMS, CRYPTO

-- profiles: drop old constraint, add new one
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_entity_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_entity_check CHECK (entity IN ('BY', 'US', 'AMS', 'CRYPTO'));

-- invitations: drop old constraint, add new one
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_entity_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_entity_check CHECK (entity IN ('BY', 'US', 'AMS', 'CRYPTO'));

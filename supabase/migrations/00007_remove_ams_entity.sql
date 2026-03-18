-- Remove AMS entity, migrate any AMS records to BY
UPDATE profiles SET entity = 'BY' WHERE entity = 'AMS';
UPDATE invitations SET entity = 'BY' WHERE entity = 'AMS';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_entity_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_entity_check CHECK (entity IN ('BY', 'US', 'CRYPTO'));

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_entity_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_entity_check CHECK (entity IN ('BY', 'US', 'CRYPTO'));

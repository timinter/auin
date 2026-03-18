-- DEV-ONLY: Function to clean up broken auth.users entries
-- created by direct SQL inserts (seed script).
-- This deletes from auth.identities and auth.users WITHOUT
-- cascading to profiles by temporarily dropping and re-adding the FK.
-- Remove this migration before deploying to production.

CREATE OR REPLACE FUNCTION public.dev_cleanup_auth_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Delete identities first
  DELETE FROM auth.identities WHERE user_id = target_user_id;

  -- Temporarily drop the FK on profiles so we don't cascade
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey_fk;

  -- Delete the broken auth.users entry
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Re-add the FK
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END;
$$;

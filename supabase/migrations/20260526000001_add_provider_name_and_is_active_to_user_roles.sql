/*
  # Add provider_name and is_active to user_roles

  Both columns are referenced throughout the app but were never added to the
  original schema. The missing is_active column is a login-breaking bug:
  resolveUserRole checks `data.is_active` and treats undefined as falsy,
  so every login attempt returns null and the user is never authenticated.

  1. Changes
     - provider_name (text, nullable) — human-readable name shown in the UI
       and used to match doctor rows to Google Sheets data
     - is_active (boolean, NOT NULL, DEFAULT true) — gates login access;
       false = account deactivated

  2. Backfill
     - All existing rows receive is_active = true automatically via the
       column DEFAULT (no extra UPDATE needed)
     - Doctor rows with a provider_id get provider_name derived from the slug:
       hyphens replaced with spaces, title-cased, and "Dr" expanded to "Dr."
       e.g. 'dr-samuel-golpanian' → 'Dr. Samuel Golpanian'
       Rows that already have provider_name set are left untouched.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_roles'
      AND column_name  = 'provider_name'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN provider_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_roles'
      AND column_name  = 'is_active'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Derive provider_name from provider_id for doctor rows that don't have one yet.
-- initcap converts slug words to title-case; regexp_replace adds the period after "Dr".
UPDATE user_roles
SET provider_name = regexp_replace(
    initcap(replace(provider_id, '-', ' ')),
    '\mDr\M',
    'Dr.',
    'g'
  )
WHERE role        = 'doctor'
  AND provider_id IS NOT NULL
  AND provider_name IS NULL;

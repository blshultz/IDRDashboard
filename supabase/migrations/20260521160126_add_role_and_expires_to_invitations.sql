/*
  # Add missing columns to invitations table

  The app code expects `role` and `expires_at` columns on invitations
  but the current table only has `status` and no expiry/role fields.

  1. Changes
    - Add `role` text column (default 'doctor')
    - Add `expires_at` timestamptz column (default 7 days from now)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'role'
  ) THEN
    ALTER TABLE invitations ADD COLUMN role text NOT NULL DEFAULT 'doctor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE invitations ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');
  END IF;
END $$;

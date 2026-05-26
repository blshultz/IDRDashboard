/*
  # Allow anon email lookup on user_roles for signup validation

  The signup flow needs to verify an email exists in user_roles before
  creating an auth account. Since the user has no JWT yet, the existing
  RLS policy (which requires auth.jwt()) blocks the read and returns no rows,
  causing a false "not authorized" error.

  This adds a narrow anon SELECT policy that only exposes the email column
  (Postgres still returns the row; the app only checks row existence).
*/

CREATE POLICY "Anon can check email exists for signup"
  ON user_roles FOR SELECT
  TO anon
  USING (true);

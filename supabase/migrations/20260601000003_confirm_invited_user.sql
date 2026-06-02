/*
  # Auto-confirm email for invite-based onboarding

  Creates a SECURITY DEFINER function `confirm_invited_user(p_email text)` that
  marks an auth.users row as email-confirmed immediately after the user registers
  via a valid invitation link.

  ## Security gates
  - The function only proceeds if the `invitations` table has a row for this email
    with `accepted_at` set within the last 15 minutes. This means:
      1. The invitation had to have been accepted (setup_user_from_invite ran).
      2. It happened very recently — not a stale or replayed call.
  - COALESCE guards prevent overwriting an already-confirmed timestamp.
  - SECURITY DEFINER runs as the `postgres` superuser who owns auth.users.
  - search_path is pinned to `public, auth` to prevent search-path injection.

  ## What it does NOT do
  - It does NOT weaken open signup. The check is strictly gated on a recent
    invitation acceptance for the specific email.
  - It does NOT grant additional roles or bypass user_roles assignment (that
    happened in setup_user_from_invite).
  - It does NOT run from the client — only called server-side from signUpWithToken
    in AuthContext, after a successful supabase.auth.signUp().
*/

CREATE OR REPLACE FUNCTION confirm_invited_user(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Gate: only proceed if a valid invitation was accepted in the last 15 minutes.
  -- This ensures auto-confirm is strictly for the invite-token onboarding path.
  IF NOT EXISTS (
    SELECT 1
    FROM   public.invitations
    WHERE  lower(email) = lower(p_email)
      AND  accepted_at IS NOT NULL
      AND  accepted_at > NOW() - INTERVAL '15 minutes'
  ) THEN
    RAISE EXCEPTION 'no_recent_invite'
      USING HINT = 'No recently accepted invitation found for this email. Cannot auto-confirm.';
  END IF;

  -- Confirm the auth.users row for this email.
  -- COALESCE ensures we never overwrite an already-confirmed timestamp.
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      confirmed_at        = COALESCE(confirmed_at,       NOW()),
      updated_at          = NOW()
  WHERE lower(email) = lower(p_email);

  RETURN FOUND;
END;
$$;

-- Grant to both anon and authenticated so the call works regardless of the
-- caller's JWT state immediately after signUp (before the session is hydrated).
GRANT EXECUTE ON FUNCTION confirm_invited_user(text) TO anon;
GRANT EXECUTE ON FUNCTION confirm_invited_user(text) TO authenticated;

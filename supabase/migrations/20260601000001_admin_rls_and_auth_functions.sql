/*
  # Admin RLS, invite acceptance RPC, and last-login helper

  1. auth_is_admin()
     SECURITY DEFINER helper used by all admin policies.
     Runs as the function owner (bypasses RLS) to avoid recursive policy checks.

  2. user_roles: updated policies
     - Authenticated users see their own row OR all rows if admin
     - Admins can insert / update rows (user management)

  3. invitations: policies
     - Anon can SELECT (needed to display invite details before sign-up)
     - Admins can manage all invitations

  4. setup_user_from_invite(p_token)
     SECURITY DEFINER so an unauthenticated visitor can trigger the
     user_roles upsert and mark the invitation accepted — all in one
     atomic transaction. Anon INSERT on user_roles is intentionally
     NOT granted; this function is the only safe pathway.

  5. admin_get_users_with_login()
     Admin-only RPC that joins user_roles with auth.users to surface
     last_sign_in_at and confirmed_at without exposing auth.users directly.
*/

-- ── 1. Helper: auth_is_admin() ────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
      AND role = 'admin'
      AND is_active = true
  )
$$;

-- ── 2. user_roles policies ─────────────────────────────────────────────

-- Replace the narrow own-row policy with one that also allows admins to see all
DROP POLICY IF EXISTS "Users can read own role row" ON user_roles;

DO $$
BEGIN
  CREATE POLICY "Users read own row, admins read all"
    ON user_roles FOR SELECT
    TO authenticated
    USING (
      lower(auth.jwt() ->> 'email') = lower(email)
      OR auth_is_admin()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admins can insert new user rows (e.g. manual add, future feature)
DO $$
BEGIN
  CREATE POLICY "Admins can insert user_roles"
    ON user_roles FOR INSERT
    TO authenticated
    WITH CHECK (auth_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admins can update user rows (deactivate, change provider, etc.)
DO $$
BEGIN
  CREATE POLICY "Admins can update user_roles"
    ON user_roles FOR UPDATE
    TO authenticated
    USING (auth_is_admin())
    WITH CHECK (auth_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. invitations policies ────────────────────────────────────────────

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Anon SELECT so the invite acceptance page can display invite details
DO $$
BEGIN
  CREATE POLICY "Anon can read invitations"
    ON invitations FOR SELECT
    TO anon
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admins can create, view, and update invitations
DO $$
BEGIN
  CREATE POLICY "Admins can manage invitations"
    ON invitations FOR ALL
    TO authenticated
    USING (auth_is_admin())
    WITH CHECK (auth_is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. setup_user_from_invite(p_token) ────────────────────────────────

CREATE OR REPLACE FUNCTION setup_user_from_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite  RECORD;
  v_pid     text;
BEGIN
  SELECT * INTO v_invite FROM invitations WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token'
      USING HINT = 'This invitation link is invalid.';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_accepted'
      USING HINT = 'This invitation has already been used.';
  END IF;
  IF v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'expired'
      USING HINT = 'This invitation link has expired. Ask your administrator to resend it.';
  END IF;

  -- Build provider_id slug from provider_name
  v_pid := CASE
    WHEN v_invite.provider_name IS NOT NULL
      THEN lower(regexp_replace(trim(v_invite.provider_name), '[^a-z0-9]+', '-', 'g'))
    ELSE NULL
  END;

  -- Upsert user_roles (SECURITY DEFINER bypasses RLS anon restriction)
  INSERT INTO user_roles (email, role, provider_name, provider_id, display_name, is_active)
  VALUES (
    lower(trim(v_invite.email)),
    COALESCE(v_invite.role, 'doctor'),
    v_invite.provider_name,
    v_pid,
    v_invite.display_name,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    role          = EXCLUDED.role,
    provider_name = EXCLUDED.provider_name,
    provider_id   = EXCLUDED.provider_id,
    display_name  = EXCLUDED.display_name,
    is_active     = true;

  -- Mark invitation accepted (atomic with the upsert above)
  UPDATE invitations
  SET accepted_at = NOW()
  WHERE token = p_token;

  RETURN json_build_object('success', true, 'email', v_invite.email);
END;
$$;

GRANT EXECUTE ON FUNCTION setup_user_from_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION setup_user_from_invite(text) TO authenticated;

-- ── 5. admin_get_users_with_login() ───────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_users_with_login()
RETURNS TABLE(
  email           text,
  last_sign_in_at timestamptz,
  confirmed_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT auth_is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    ur.email,
    au.last_sign_in_at,
    au.confirmed_at
  FROM user_roles ur
  LEFT JOIN auth.users au ON lower(ur.email) = lower(au.email);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_users_with_login() TO authenticated;

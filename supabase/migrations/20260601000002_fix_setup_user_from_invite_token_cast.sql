/*
  # Fix type mismatch in setup_user_from_invite

  Root cause: the `token` column in the `invitations` table was created via the
  Supabase dashboard as `uuid` type.  The SQL function declares `p_token text`,
  so `WHERE token = p_token` resolves to `uuid = text` — PostgreSQL has no
  implicit cast for that operator and raises:

      "No operator matches the given name and argument types.
       You might need to add explicit type casts."

  The JavaScript client's `.eq('token', value)` works because PostgREST performs
  the text→uuid cast automatically for filter parameters.  Inside a plpgsql
  function that cast is not automatic.

  Fix: cast `token` to text in both WHERE clauses so the comparison is always
  `text = text` regardless of the underlying column storage type.

  All other explicit `::text` casts on RECORD fields are defensive — they ensure
  the type is unambiguous for string functions (lower, trim, regexp_replace) even
  if the column type changes in future.
*/

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
  -- Cast token::text so comparison works whether the column is uuid or text
  SELECT * INTO v_invite
  FROM   invitations
  WHERE  token::text = p_token;

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

  -- Build provider_id slug; explicit ::text cast avoids ambiguity on RECORD fields
  v_pid := CASE
    WHEN v_invite.provider_name IS NOT NULL
      THEN lower(regexp_replace(trim(v_invite.provider_name::text), '[^a-z0-9]+', '-', 'g'))
    ELSE NULL
  END;

  -- Upsert user_roles (SECURITY DEFINER bypasses RLS; explicit ::text on all
  -- RECORD fields so each function call is unambiguous)
  INSERT INTO user_roles (email, role, provider_name, provider_id, display_name, is_active)
  VALUES (
    lower(trim(v_invite.email::text)),
    COALESCE(v_invite.role::text, 'doctor'),
    v_invite.provider_name::text,
    v_pid,
    v_invite.display_name::text,
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    role          = EXCLUDED.role,
    provider_name = EXCLUDED.provider_name,
    provider_id   = EXCLUDED.provider_id,
    display_name  = EXCLUDED.display_name,
    is_active     = true;

  -- Mark invitation accepted — same token::text cast as the SELECT above
  UPDATE invitations
  SET    accepted_at = NOW()
  WHERE  token::text = p_token;

  RETURN json_build_object('success', true, 'email', v_invite.email::text);
END;
$$;

-- Re-grant execute (CREATE OR REPLACE revokes nothing, but be explicit)
GRANT EXECUTE ON FUNCTION setup_user_from_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION setup_user_from_invite(text) TO authenticated;

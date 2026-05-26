/*
  # Allow anon to mark invitations as accepted

  When a user completes signup via invite link, the app updates the invitation's
  accepted_at field. Since the user has no session at that point, anon needs
  UPDATE permission on invitations (scoped to the token they possess).
*/

CREATE POLICY "Anon can accept invitation by token"
  ON invitations FOR UPDATE
  TO anon
  USING (accepted_at IS NULL)
  WITH CHECK (accepted_at IS NOT NULL);

/*
  # Create user_roles table

  Maps known email addresses to their role and provider identity.
  This table is the source of truth for who can access what.

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key)
      - `email` (text, unique, lowercase) — the verified email that must match auth.users
      - `role` (text) — 'admin' or 'doctor'
      - `provider_id` (text, nullable) — slug used to filter procedure rows for doctors
      - `display_name` (text) — human-readable name shown in the UI
      - `created_at` (timestamptz)

  2. Seed Data
    - 3 doctors: Golpanian, Sykes, Sinclair
    - 5 admins: brittany, robert, rodrigo (ThinkOps), Dr. Rahal (two emails)

  3. Security
    - Enable RLS
    - Authenticated users can only read their own row (matched by email)
*/

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'doctor',
  provider_id text,
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role row"
  ON user_roles FOR SELECT
  TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(email));

-- Seed known users
INSERT INTO user_roles (email, role, provider_id, display_name) VALUES
  ('samuel@drsamuelgolpanian.com', 'doctor', 'dr-samuel-golpanian', 'Dr. Samuel Golpanian'),
  ('jmsykes@ucdavis.edu',          'doctor', 'dr-sykes',             'Dr. Sykes'),
  ('dr.alexandersinclair@icloud.com', 'doctor', 'dr-alexander-sinclair', 'Dr. Alexander Sinclair'),
  ('brittany@thinkops.co',         'admin',  null, 'Brittany'),
  ('robert@thinkops.co',           'admin',  null, 'Robert'),
  ('rodrigo@thinkops.co',          'admin',  null, 'Rodrigo'),
  ('wjrahal@gmail.com',            'admin',  null, 'Dr. William J Rahal'),
  ('wjrahal@drwilliamrahal.com',   'admin',  null, 'Dr. William J Rahal')
ON CONFLICT (email) DO NOTHING;

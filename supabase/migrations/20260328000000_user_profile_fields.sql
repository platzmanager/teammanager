-- Add personal fields to user_profiles (user-managed profile data)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

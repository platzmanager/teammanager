-- Move role from user_profiles to user_clubs (per-club role)
-- Remove dead user_profiles.player_uuid column

-- ─── 1. Add role column to user_clubs ───

ALTER TABLE user_clubs
  ADD COLUMN role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- ─── 2. Migrate existing role data ───

UPDATE user_clubs uc
SET role = up.role
FROM user_profiles up
WHERE uc.user_id = up.id;

-- ─── 3. Create user_is_club_admin() helper ───

CREATE OR REPLACE FUNCTION user_is_club_admin(p_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_clubs
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role = 'admin'
  );
$$;

-- ─── 4. Drop dead "player read own" policies ───

DROP POLICY IF EXISTS "player read own" ON players;
DROP POLICY IF EXISTS "player read own" ON player_registrations;

-- ─── 5. Replace admin RLS policies ───

-- 5a. players
DROP POLICY IF EXISTS "admin full access" ON players;
CREATE POLICY "admin full access" ON players FOR ALL TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id))
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5b. teams
DROP POLICY IF EXISTS "admin write" ON teams;
CREATE POLICY "admin write" ON teams FOR ALL TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id))
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5c. player_registrations
DROP POLICY IF EXISTS "admin write" ON player_registrations;
DROP POLICY IF EXISTS "admin full access" ON player_registrations;
CREATE POLICY "admin full access" ON player_registrations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_admin(p.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_admin(p.club_id)
    )
  );

-- 5d. matches (3 policies)
DROP POLICY IF EXISTS "Admins can insert matches" ON matches;
CREATE POLICY "Admins can insert matches" ON matches FOR INSERT TO authenticated
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can update matches" ON matches;
CREATE POLICY "Admins can update matches" ON matches FOR UPDATE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches" ON matches FOR DELETE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5e. members (3 policies)
DROP POLICY IF EXISTS "Admins can insert members" ON members;
CREATE POLICY "Admins can insert members" ON members FOR INSERT TO authenticated
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can update members" ON members;
CREATE POLICY "Admins can update members" ON members FOR UPDATE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can delete members" ON members;
CREATE POLICY "Admins can delete members" ON members FOR DELETE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5f. member_team_assignments (2 policies)
DROP POLICY IF EXISTS "Admins can manage member team assignments" ON member_team_assignments;
CREATE POLICY "Admins can manage member team assignments"
  ON member_team_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_admin(m.club_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete member team assignments" ON member_team_assignments;
CREATE POLICY "Admins can delete member team assignments"
  ON member_team_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_admin(m.club_id)
    )
  );

-- 5g. events
DROP POLICY IF EXISTS "Admins can manage all events" ON events;
CREATE POLICY "Admins can manage all events" ON events FOR ALL TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id))
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5h. event_occurrences
DROP POLICY IF EXISTS "Admins can manage all event occurrences" ON event_occurrences;
CREATE POLICY "Admins can manage all event occurrences"
  ON event_occurrences FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id AND user_is_club_admin(e.club_id)
    )
  );

-- ─── 6. Admin management policy on user_clubs ───

CREATE POLICY "admin can manage club members" ON user_clubs FOR ALL TO authenticated
  USING (user_is_club_admin(club_id))
  WITH CHECK (user_is_club_admin(club_id));

-- ─── 7. Drop columns from user_profiles ───

ALTER TABLE user_profiles DROP COLUMN player_uuid;
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles DROP COLUMN role;

-- ─── 8. Index for admin lookups ───

CREATE INDEX idx_user_clubs_admin ON user_clubs (club_id, user_id) WHERE role = 'admin';

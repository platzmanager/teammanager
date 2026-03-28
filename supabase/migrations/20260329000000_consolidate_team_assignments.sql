-- Consolidate user_team_assignments into member_team_assignments
-- Captain/player role now lives on the team assignment, not on user_profiles

-- ─── 1. Add role column to member_team_assignments ───

ALTER TABLE member_team_assignments
  ADD COLUMN role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'captain'));

-- ─── 2. Match captains to existing members by email and migrate assignments ───

INSERT INTO member_team_assignments (member_id, team_id, role)
SELECT m.id, uta.team_id, 'captain'
FROM user_team_assignments uta
JOIN auth.users u ON u.id = uta.user_id
JOIN teams t ON t.id = uta.team_id
JOIN members m ON m.email = u.email AND m.club_id = t.club_id
ON CONFLICT (member_id, team_id) DO UPDATE SET role = 'captain';

-- Also set member.user_id for matched captains (may have been imported without user link)
UPDATE members m SET user_id = u.id
FROM user_team_assignments uta
JOIN auth.users u ON u.id = uta.user_id
JOIN teams t ON t.id = uta.team_id
WHERE m.email = u.email AND m.club_id = t.club_id
  AND m.user_id IS NULL;

-- ─── 3. Fallback: create members for captains not matched by email ───

INSERT INTO members (club_id, user_id, first_name, last_name, email)
SELECT DISTINCT t.club_id, uta.user_id,
  COALESCE(NULLIF(up.first_name, ''), split_part(u.email, '@', 1)),
  COALESCE(NULLIF(up.last_name, ''), ''),
  u.email
FROM user_team_assignments uta
JOIN user_profiles up ON up.id = uta.user_id
JOIN auth.users u ON u.id = up.id
JOIN teams t ON t.id = uta.team_id
WHERE NOT EXISTS (
  SELECT 1 FROM members m WHERE m.user_id = uta.user_id AND m.club_id = t.club_id
)
ON CONFLICT DO NOTHING;

-- Insert captain assignments for the fallback members
INSERT INTO member_team_assignments (member_id, team_id, role)
SELECT m.id, uta.team_id, 'captain'
FROM user_team_assignments uta
JOIN teams t ON t.id = uta.team_id
JOIN members m ON m.user_id = uta.user_id AND m.club_id = t.club_id
ON CONFLICT (member_id, team_id) DO UPDATE SET role = 'captain';

-- ─── 4. Helper function for RLS captain checks ───

CREATE OR REPLACE FUNCTION user_is_captain_of_team(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_team_assignments mta
    JOIN members m ON m.id = mta.member_id
    WHERE m.user_id = auth.uid()
      AND mta.team_id = p_team_id
      AND mta.role = 'captain'
  );
$$;

-- ─── 5. Replace RLS policies that reference user_team_assignments ───

-- 5a. players: captain access own teams (latest version from 20260305000000)
DROP POLICY IF EXISTS "captain access own teams" ON players;
CREATE POLICY "captain access own teams" ON players FOR ALL TO authenticated
  USING (
    user_is_club_member(club_id)
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND CASE
          WHEN t.age_class LIKE 'u%' THEN
            (extract(year FROM current_date) - extract(year FROM players.birth_date))
              <= CASE t.age_class
                WHEN 'u9' THEN 9 WHEN 'u10' THEN 10 WHEN 'u12' THEN 12
                WHEN 'u15' THEN 15 WHEN 'u18' THEN 18
              END
            AND (
              t.age_class IN ('u9','u10','u12')
              OR (t.gender = 'female' AND players.gender = 'female')
              OR t.gender = 'male'
            )
          WHEN t.age_class = 'all' THEN
            t.gender = players.gender
          ELSE
            t.gender = players.gender
            AND (extract(year FROM current_date) - extract(year FROM players.birth_date)) >= t.age_class::int
        END
    )
  )
  WITH CHECK (
    user_is_club_member(club_id)
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND CASE
          WHEN t.age_class LIKE 'u%' THEN
            (extract(year FROM current_date) - extract(year FROM players.birth_date))
              <= CASE t.age_class
                WHEN 'u9' THEN 9 WHEN 'u10' THEN 10 WHEN 'u12' THEN 12
                WHEN 'u15' THEN 15 WHEN 'u18' THEN 18
              END
            AND (
              t.age_class IN ('u9','u10','u12')
              OR (t.gender = 'female' AND players.gender = 'female')
              OR t.gender = 'male'
            )
          WHEN t.age_class = 'all' THEN
            t.gender = players.gender
          ELSE
            t.gender = players.gender
            AND (extract(year FROM current_date) - extract(year FROM players.birth_date)) >= t.age_class::int
        END
    )
  );

-- 5b. player_registrations: captain access own teams (latest version from 20260302000000)
DROP POLICY IF EXISTS "captain access own teams" ON player_registrations;
CREATE POLICY "captain access own teams" ON player_registrations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_member(p.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND t.gender = player_registrations.gender
        AND t.age_class = player_registrations.age_class
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_member(p.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND t.gender = player_registrations.gender
        AND t.age_class = player_registrations.age_class
    )
  );

-- 5c. member_team_assignments: captain insert/delete
DROP POLICY IF EXISTS "Captains can insert member team assignments for their teams" ON member_team_assignments;
CREATE POLICY "Captains can insert member team assignments for their teams"
  ON member_team_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_member(m.club_id)
    )
    AND user_is_captain_of_team(team_id)
  );

DROP POLICY IF EXISTS "Captains can delete member team assignments for their teams" ON member_team_assignments;
CREATE POLICY "Captains can delete member team assignments for their teams"
  ON member_team_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_member(m.club_id)
    )
    AND user_is_captain_of_team(team_id)
  );

-- 5d. events: captain manage team events
DROP POLICY IF EXISTS "Captains can manage team events" ON events;
CREATE POLICY "Captains can manage team events"
  ON events FOR ALL TO authenticated
  USING (
    team_id IS NOT NULL
    AND user_is_club_member(club_id)
    AND user_is_captain_of_team(team_id)
  )
  WITH CHECK (
    team_id IS NOT NULL
    AND user_is_club_member(club_id)
    AND user_is_captain_of_team(team_id)
  );

-- 5e. event_occurrences: captain manage team event occurrences
DROP POLICY IF EXISTS "Captains can manage team event occurrences" ON event_occurrences;
CREATE POLICY "Captains can manage team event occurrences"
  ON event_occurrences FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND e.team_id IS NOT NULL
      AND user_is_club_member(e.club_id)
      AND user_is_captain_of_team(e.team_id)
    )
  );

-- ─── 6. Update user_profiles role: captain/player → user ───

UPDATE user_profiles SET role = 'user' WHERE role IN ('captain', 'player');
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'user'));
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'user';

-- ─── 7. Drop old table ───

DROP POLICY IF EXISTS "authenticated read" ON user_team_assignments;
DROP POLICY IF EXISTS "admin write" ON user_team_assignments;
DROP TABLE user_team_assignments;

-- ─── 8. Index for captain lookups ───

CREATE INDEX idx_member_team_role ON member_team_assignments (team_id, role)
  WHERE role = 'captain';

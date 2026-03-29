-- Match lineup planning for team captains

CREATE TABLE match_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_uuid uuid NOT NULL REFERENCES players(uuid) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_uuid)
);

CREATE INDEX idx_match_lineups_match ON match_lineups (match_id);
CREATE INDEX idx_match_lineups_player ON match_lineups (player_uuid);

ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;

-- All club members can read lineups
CREATE POLICY "Club members can read lineups"
  ON match_lineups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_club_member(m.club_id)
    )
  );

-- Admins can manage all lineups
CREATE POLICY "Admins can manage lineups"
  ON match_lineups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_club_admin(m.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_club_admin(m.club_id)
    )
  );

-- Captains can manage lineups for their team's matches
CREATE POLICY "Captains can manage team lineups"
  ON match_lineups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_captain_of_team(m.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_captain_of_team(m.team_id)
    )
  );

-- Clean up: remove legacy team_id column, superseded by user_team_assignments
ALTER TABLE user_profiles DROP COLUMN IF EXISTS team_id;

-- Fix mutable search_path on user_is_club_member,
-- prevents search path manipulation attacks on the security definer function
CREATE OR REPLACE FUNCTION user_is_club_member(p_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_clubs
    WHERE user_id = auth.uid() AND club_id = p_club_id
  );
$$;

-- Atomic lineup replace: delete + insert in a single transaction
CREATE OR REPLACE FUNCTION replace_match_lineup(
  p_match_id uuid,
  p_player_uuids uuid[],
  p_created_by uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM match_lineups WHERE match_id = p_match_id;

  IF array_length(p_player_uuids, 1) IS NOT NULL THEN
    INSERT INTO match_lineups (match_id, player_uuid, created_by)
    SELECT p_match_id, unnest(p_player_uuids), p_created_by;
  END IF;
END;
$$;

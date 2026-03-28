-- External member ID for matching on re-imports
ALTER TABLE members ADD COLUMN IF NOT EXISTS external_id text;

-- Unique per club to allow upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_club_external_id
  ON members (club_id, external_id) WHERE external_id IS NOT NULL;

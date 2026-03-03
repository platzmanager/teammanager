-- Add team_size and rank columns to teams
ALTER TABLE teams
  ADD COLUMN team_size smallint NOT NULL DEFAULT 6 CHECK (team_size IN (4, 6)),
  ADD COLUMN rank smallint NOT NULL DEFAULT 1;

-- Auto-assign rank for existing teams based on creation order within each group
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY club_id, gender, age_class ORDER BY created_at
  )::smallint AS computed_rank
  FROM teams
)
UPDATE teams SET rank = ranked.computed_rank FROM ranked WHERE teams.id = ranked.id;

-- Add unique constraint
ALTER TABLE teams ADD CONSTRAINT teams_club_gender_age_rank_unique
  UNIQUE (club_id, gender, age_class, rank);

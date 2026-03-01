-- Change sort_position from integer to numeric for gap-based positioning
ALTER TABLE players ALTER COLUMN sort_position TYPE numeric USING sort_position::numeric;

-- Create initial gaps (multiply existing positions by 100)
UPDATE players SET sort_position = sort_position * 100;

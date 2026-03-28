-- Track how a member record was created
ALTER TABLE members ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'import';

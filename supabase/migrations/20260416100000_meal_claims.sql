-- ═══════════════════════════════════════════════════════════════
-- ESSENSZUSCHUSS — Meal subsidy management for TC Thalkirchen
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Add 'gastro' role to user_clubs ────────────────────────
ALTER TABLE user_clubs
  DROP CONSTRAINT IF EXISTS user_clubs_role_check;

ALTER TABLE user_clubs
  ADD CONSTRAINT user_clubs_role_check
  CHECK (role IN ('admin', 'user', 'gastro'));

-- ─── 2. Helper: is current user gastro for a club? ─────────────
CREATE OR REPLACE FUNCTION user_is_club_gastro(p_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_clubs
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role IN ('gastro', 'admin')
  );
$$;

-- ─── 3. meal_settings — one row per club ───────────────────────
CREATE TABLE meal_settings (
  club_id         uuid PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
  amount_per_meal numeric(10,2) NOT NULL DEFAULT 10.00,
  billing_interval text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'quarterly', 'seasonal')),
  finance_email   text,
  season_start    date,
  season_end      date,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can read meal settings"
  ON meal_settings FOR SELECT TO authenticated
  USING (user_is_club_member(club_id));

CREATE POLICY "Admins can manage meal settings"
  ON meal_settings FOR ALL TO authenticated
  USING (user_is_club_admin(club_id))
  WITH CHECK (user_is_club_admin(club_id));

-- ─── 4. meal_claims — one claim per home match ─────────────────
CREATE TABLE meal_claims (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  match_id        uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  captain_id      uuid NOT NULL REFERENCES user_profiles(id),
  meal_count      int NOT NULL CHECK (meal_count >= 0 AND meal_count <= 20),
  amount_per_meal numeric(10,2) NOT NULL DEFAULT 10.00,
  notes           text,
  status          text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'confirmed', 'settled')),
  confirmed_at    timestamptz,
  settled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id)
);

CREATE INDEX idx_meal_claims_club   ON meal_claims (club_id);
CREATE INDEX idx_meal_claims_match  ON meal_claims (match_id);
CREATE INDEX idx_meal_claims_status ON meal_claims (club_id, status);
CREATE INDEX idx_meal_claims_date   ON meal_claims (club_id, created_at);

ALTER TABLE meal_claims ENABLE ROW LEVEL SECURITY;

-- All club members can read claims
CREATE POLICY "Club members can read meal claims"
  ON meal_claims FOR SELECT TO authenticated
  USING (user_is_club_member(club_id));

-- Captains can create/update claims for their own team matches
CREATE POLICY "Captains can create meal claims"
  ON meal_claims FOR INSERT TO authenticated
  WITH CHECK (
    user_is_club_member(club_id)
    AND auth.uid() = captain_id
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND m.is_home = true
        AND user_is_captain_of_team(m.team_id)
    )
  );

CREATE POLICY "Captains can update their meal claims"
  ON meal_claims FOR UPDATE TO authenticated
  USING (
    auth.uid() = captain_id
    AND status = 'submitted'
  )
  WITH CHECK (
    auth.uid() = captain_id
    AND status = 'submitted'
  );

-- Gastro & Admins can confirm claims
CREATE POLICY "Gastro can confirm meal claims"
  ON meal_claims FOR UPDATE TO authenticated
  USING (user_is_club_gastro(club_id))
  WITH CHECK (user_is_club_gastro(club_id));

-- Admins full access
CREATE POLICY "Admins can manage all meal claims"
  ON meal_claims FOR ALL TO authenticated
  USING (user_is_club_admin(club_id))
  WITH CHECK (user_is_club_admin(club_id));

-- ─── 5. updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_meal_claims_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER meal_claims_updated_at
  BEFORE UPDATE ON meal_claims
  FOR EACH ROW EXECUTE FUNCTION update_meal_claims_updated_at();

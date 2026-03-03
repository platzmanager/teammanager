-- Fix age class RLS: use year-based calculation instead of exact age.
-- In tennis, age class eligibility is based on the year you turn that age,
-- not your exact birthday. E.g. a player turning 40 in 2026 is eligible
-- for age class 40 all year, even before their birthday.

drop policy if exists "captain access own teams" on players;
create policy "captain access own teams" on players for all to authenticated
  using (
    user_is_club_member(club_id)
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = players.gender
        and (
          t.age_class = 'all'
          or (extract(year from current_date) - extract(year from players.birth_date)) >= t.age_class::int
        )
    )
  )
  with check (
    user_is_club_member(club_id)
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = players.gender
        and (
          t.age_class = 'all'
          or (extract(year from current_date) - extract(year from players.birth_date)) >= t.age_class::int
        )
    )
  );

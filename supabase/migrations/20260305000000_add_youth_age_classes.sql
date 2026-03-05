-- Add youth age classes (u9, u10, u12, u15, u18)

-- 1. Update CHECK constraints
alter table teams drop constraint if exists teams_age_class_check;
alter table teams add constraint teams_age_class_check
  check (age_class in ('all','30','40','50','60','u9','u10','u12','u15','u18'));

alter table player_registrations drop constraint if exists player_registrations_age_class_check;
alter table player_registrations add constraint player_registrations_age_class_check
  check (age_class in ('all','30','40','50','60','u9','u10','u12','u15','u18'));

-- 2. Update RLS policy on players to support youth age classes
drop policy if exists "captain access own teams" on players;
create policy "captain access own teams" on players for all to authenticated
  using (
    user_is_club_member(club_id)
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and case
          -- Youth classes: max age check + gender logic
          when t.age_class like 'u%' then
            (extract(year from current_date) - extract(year from players.birth_date))
              <= case t.age_class
                when 'u9' then 9
                when 'u10' then 10
                when 'u12' then 12
                when 'u15' then 15
                when 'u18' then 18
              end
            and (
              t.age_class in ('u9','u10','u12')  -- mixed, no gender check
              or (t.gender = 'female' and players.gender = 'female')
              or t.gender = 'male'  -- male youth teams allow all genders
            )
          -- Senior "all": no age restriction, gender must match
          when t.age_class = 'all' then
            t.gender = players.gender
          -- Senior age classes: min age check, gender must match
          else
            t.gender = players.gender
            and (extract(year from current_date) - extract(year from players.birth_date)) >= t.age_class::int
        end
    )
  )
  with check (
    user_is_club_member(club_id)
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and case
          when t.age_class like 'u%' then
            (extract(year from current_date) - extract(year from players.birth_date))
              <= case t.age_class
                when 'u9' then 9
                when 'u10' then 10
                when 'u12' then 12
                when 'u15' then 15
                when 'u18' then 18
              end
            and (
              t.age_class in ('u9','u10','u12')
              or (t.gender = 'female' and players.gender = 'female')
              or t.gender = 'male'
            )
          when t.age_class = 'all' then
            t.gender = players.gender
          else
            t.gender = players.gender
            and (extract(year from current_date) - extract(year from players.birth_date)) >= t.age_class::int
        end
    )
  );

-- Rename age_class 'offen' → 'all' everywhere and add slug column to teams.

-- 1. Drop old CHECK constraints first
alter table teams drop constraint if exists teams_age_class_check;
alter table player_registrations drop constraint if exists player_registrations_age_class_check;

-- 2. Rename age_class values
update teams set age_class = 'all' where age_class = 'offen';
update player_registrations set age_class = 'all' where age_class = 'offen';

-- 3. Add new CHECK constraints
alter table teams add constraint teams_age_class_check
  check (age_class in ('all','30','40','50','60'));

alter table player_registrations add constraint player_registrations_age_class_check
  check (age_class in ('all','30','40','50','60'));

-- 3. Update RLS policies referencing 'offen'
-- In permissions.sql and clubs.sql, the captain policies for players reference t.age_class = 'offen'
-- We need to drop and recreate those policies

-- Players captain policy (from clubs.sql)
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
          or extract(year from age(players.birth_date)) >= t.age_class::int
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
          or extract(year from age(players.birth_date)) >= t.age_class::int
        )
    )
  );

-- 4. Add slug column to teams
alter table teams add column slug text;

-- 5. Backfill slugs: first team per (club_id, gender, age_class) gets age_class as slug,
--    subsequent ones get age_class-2, age_class-3, etc.
with numbered as (
  select id, age_class, row_number() over (
    partition by club_id, gender, age_class order by created_at
  ) as rn
  from teams
)
update teams set slug = case
  when numbered.rn = 1 then numbered.age_class
  else numbered.age_class || '-' || numbered.rn
end
from numbered
where teams.id = numbered.id;

-- 6. Set NOT NULL and add unique constraint
alter table teams alter column slug set not null;
alter table teams add constraint teams_club_gender_slug_unique unique (club_id, gender, slug);

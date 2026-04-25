create type gender_enum as enum ('damen', 'herren');

create table players (
  uuid uuid primary key default gen_random_uuid(),
  license text,
  last_name text not null,
  first_name text not null,
  birth_date date not null,
  skill_level numeric(3,1) not null check (skill_level >= 1 and skill_level <= 25),
  gender gender_enum not null,
  sort_position integer not null default 0,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- RLS
alter table players enable row level security;
create policy "auth read" on players for select to authenticated using (true);
create policy "auth insert" on players for insert to authenticated with check (true);
create policy "auth update" on players for update to authenticated using (true);
create policy "auth delete" on players for delete to authenticated using (true);

-- Registrations
create table player_registrations (
  player_uuid uuid references players(uuid) on delete cascade,
  age_class text not null check (age_class in ('offen','30','40','50','60')),
  gender gender_enum not null,
  primary key (player_uuid, age_class, gender)
);

alter table player_registrations enable row level security;
create policy "auth read" on player_registrations for select to authenticated using (true);
create policy "auth insert" on player_registrations for insert to authenticated with check (true);
create policy "auth delete" on player_registrations for delete to authenticated using (true);

-- Event log
create table event_log (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('reorder', 'register', 'unregister', 'create', 'update', 'delete')),
  gender gender_enum not null,
  age_class text,
  player_uuid uuid references players(uuid) on delete set null,
  details jsonb,
  user_id uuid,
  created_at timestamptz default now()
);

-- Enable realtime
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table player_registrations;

alter table event_log enable row level security;
create policy "auth read" on event_log for select to authenticated using (true);
create policy "auth insert" on event_log for insert to authenticated with check (true);

-- Teams table (created first, no FK to user_profiles)
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  gender gender_enum not null,
  age_class text not null check (age_class in ('offen','30','40','50','60')),
  created_at timestamptz default now()
);

-- User profiles table
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'captain')) default 'captain',
  team_id uuid references teams(id) on delete set null,
  created_at timestamptz default now()
);

-- RLS for teams (now user_profiles exists)
alter table teams enable row level security;
create policy "auth read" on teams for select to authenticated using (true);
create policy "admin write" on teams for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- RLS for user_profiles
alter table user_profiles enable row level security;
create policy "auth read" on user_profiles for select to authenticated using (true);

-- Replace players write policies with role-based ones
drop policy if exists "auth insert" on players;
drop policy if exists "auth update" on players;
drop policy if exists "auth delete" on players;

create policy "admin write" on players for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "captain write own gender" on players for all to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join teams t on t.id = up.team_id
      where up.id = auth.uid() and up.role = 'captain' and t.gender = players.gender
    )
  )
  with check (
    exists (
      select 1 from user_profiles up
      join teams t on t.id = up.team_id
      where up.id = auth.uid() and up.role = 'captain' and t.gender = players.gender
    )
  );

-- Replace player_registrations write policies with role-based ones
drop policy if exists "auth insert" on player_registrations;
drop policy if exists "auth delete" on player_registrations;

create policy "admin write" on player_registrations for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "captain write own team" on player_registrations for all to authenticated
  using (
    exists (
      select 1 from user_profiles up
      join teams t on t.id = up.team_id
      where up.id = auth.uid() and up.role = 'captain'
        and t.gender = player_registrations.gender
        and t.age_class = player_registrations.age_class
    )
  )
  with check (
    exists (
      select 1 from user_profiles up
      join teams t on t.id = up.team_id
      where up.id = auth.uid() and up.role = 'captain'
        and t.gender = player_registrations.gender
        and t.age_class = player_registrations.age_class
    )
  );

-- Make skill_level nullable
alter table players alter column skill_level drop not null;
alter table players drop constraint if exists players_skill_level_check;
alter table players add constraint players_skill_level_check
  check (skill_level is null or (skill_level >= 1 and skill_level <= 25));

-- Add csv_import to event_log event_type check
alter table event_log drop constraint if exists event_log_event_type_check;
alter table event_log add constraint event_log_event_type_check
  check (event_type in ('reorder', 'register', 'unregister', 'create', 'update', 'delete', 'csv_import'));

-- Change sort_position from integer to numeric for gap-based positioning
ALTER TABLE players ALTER COLUMN sort_position TYPE numeric USING sort_position::numeric;

-- Create initial gaps (multiply existing positions by 100)
UPDATE players SET sort_position = sort_position * 100;

-- 1. Add 'player' role
alter table user_profiles drop constraint user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('admin', 'captain', 'player'));
alter table user_profiles alter column role set default 'player';

-- 2. Add player_uuid to user_profiles
alter table user_profiles add column player_uuid uuid references players(uuid) on delete set null;

-- 3. Create user_team_assignments (many-to-many)
create table user_team_assignments (
  user_id uuid references user_profiles(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  primary key (user_id, team_id)
);
alter table user_team_assignments enable row level security;
create policy "authenticated read" on user_team_assignments for select to authenticated using (true);
create policy "admin write" on user_team_assignments for all to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

-- 4. Migrate existing team_id data
insert into user_team_assignments (user_id, team_id)
  select id, team_id from user_profiles where team_id is not null;

-- 5. Update RLS on players
drop policy if exists "captain write own gender" on players;
drop policy if exists "auth read" on players;

-- Admin: full access
create policy "admin full access" on players for all to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

-- Player: read own record only
create policy "player read own" on players for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'player' and player_uuid = players.uuid
    )
  );

-- Captain: read/write players matching gender + age eligibility
-- age_class 'offen' = all ages; otherwise player must be >= age_class years old
create policy "captain access own teams" on players for all to authenticated
  using (
    exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = players.gender
        and (
          t.age_class = 'offen'
          or extract(year from age(players.birth_date)) >= t.age_class::int
        )
    )
  )
  with check (
    exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = players.gender
        and (
          t.age_class = 'offen'
          or extract(year from age(players.birth_date)) >= t.age_class::int
        )
    )
  );

-- 6. Update RLS on player_registrations
drop policy if exists "captain write own team" on player_registrations;
drop policy if exists "auth read" on player_registrations;

-- Admin: full access
create policy "admin full access" on player_registrations for all to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

-- Player: read own registrations
create policy "player read own" on player_registrations for select to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'player' and player_uuid = player_registrations.player_uuid
    )
  );

-- Captain: own gender+age_class combos
create policy "captain access own teams" on player_registrations for all to authenticated
  using (
    exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = player_registrations.gender
        and t.age_class = player_registrations.age_class
    )
  )
  with check (
    exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = player_registrations.gender
        and t.age_class = player_registrations.age_class
    )
  );

-- Rename gender_enum values: damen -> female, herren -> male
alter type gender_enum rename value 'damen' to 'female';
alter type gender_enum rename value 'herren' to 'male';

-- Multi-tenancy: clubs
-- Adds club scoping to players, teams, and event_log.

-- 1. Create clubs table
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz default now()
);

alter table clubs enable row level security;

-- 2. Create user_clubs join table
create table user_clubs (
  user_id uuid references auth.users(id) on delete cascade,
  club_id uuid references clubs(id) on delete cascade,
  primary key (user_id, club_id)
);

alter table user_clubs enable row level security;
create policy "authenticated read own" on user_clubs for select to authenticated
  using (user_id = auth.uid());

-- 3. Seed TC Thalkirchen as the first club
insert into clubs (id, name, slug)
  values ('1d39bc03-0178-45ab-bf5f-3bb3eccf3719', 'TC Thalkirchen', 'tcthalkirchen');

-- 4. Add club_id columns (nullable first)
alter table players add column club_id uuid references clubs(id);
alter table teams add column club_id uuid references clubs(id);
alter table event_log add column club_id uuid references clubs(id);

-- 5. Backfill all existing rows to TC Thalkirchen
update players set club_id = '1d39bc03-0178-45ab-bf5f-3bb3eccf3719' where club_id is null;
update teams set club_id = '1d39bc03-0178-45ab-bf5f-3bb3eccf3719' where club_id is null;
update event_log set club_id = '1d39bc03-0178-45ab-bf5f-3bb3eccf3719' where club_id is null;

-- 6. Set NOT NULL
alter table players alter column club_id set not null;
alter table teams alter column club_id set not null;
alter table event_log alter column club_id set not null;

-- 7. Insert all existing users into user_clubs for TC Thalkirchen
insert into user_clubs (user_id, club_id)
  select id, '1d39bc03-0178-45ab-bf5f-3bb3eccf3719'
  from auth.users
  on conflict do nothing;

-- 8. Update unique constraint on teams: name unique per club
alter table teams drop constraint teams_name_key;
alter table teams add constraint teams_name_club_unique unique (name, club_id);

-- 9. Indexes
create index idx_players_club_gender on players (club_id, gender);
create index idx_teams_club on teams (club_id);
create index idx_event_log_club on event_log (club_id);

-- 10. Helper function for RLS — checks user is member of a given club
create or replace function user_is_club_member(p_club_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from user_clubs
    where user_id = auth.uid() and club_id = p_club_id
  );
$$;

-- 11. Clubs RLS — scoped to user's memberships (must come after function definition)
create policy "authenticated read" on clubs for select to authenticated
  using (user_is_club_member(id));

-- 12. Replace ALL existing RLS policies with club-scoped versions

-- === players ===
drop policy if exists "admin write" on players;
drop policy if exists "admin full access" on players;
drop policy if exists "player read own" on players;
drop policy if exists "captain access own teams" on players;

create policy "admin full access" on players for all to authenticated
  using (
    user_is_club_member(club_id)
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    user_is_club_member(club_id)
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "player read own" on players for select to authenticated
  using (
    user_is_club_member(club_id)
    and exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'player' and player_uuid = players.uuid
    )
  );

create policy "captain access own teams" on players for all to authenticated
  using (
    user_is_club_member(club_id)
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = players.gender
        and (
          t.age_class = 'offen'
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
          t.age_class = 'offen'
          or extract(year from age(players.birth_date)) >= t.age_class::int
        )
    )
  );

-- === teams ===
drop policy if exists "auth read" on teams;
drop policy if exists "admin write" on teams;

create policy "club read" on teams for select to authenticated
  using (user_is_club_member(club_id));

create policy "admin write" on teams for all to authenticated
  using (
    user_is_club_member(club_id)
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    user_is_club_member(club_id)
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- === player_registrations (scoped via join to players) ===
drop policy if exists "admin full access" on player_registrations;
drop policy if exists "player read own" on player_registrations;
drop policy if exists "captain access own teams" on player_registrations;

create policy "admin full access" on player_registrations for all to authenticated
  using (
    exists (
      select 1 from players p
      where p.uuid = player_registrations.player_uuid
        and user_is_club_member(p.club_id)
    )
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (
      select 1 from players p
      where p.uuid = player_registrations.player_uuid
        and user_is_club_member(p.club_id)
    )
    and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "player read own" on player_registrations for select to authenticated
  using (
    exists (
      select 1 from players p
      join user_profiles up on up.player_uuid = p.uuid
      where p.uuid = player_registrations.player_uuid
        and user_is_club_member(p.club_id)
        and up.id = auth.uid()
        and up.role = 'player'
    )
  );

create policy "captain access own teams" on player_registrations for all to authenticated
  using (
    exists (
      select 1 from players p
      where p.uuid = player_registrations.player_uuid
        and user_is_club_member(p.club_id)
    )
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = player_registrations.gender
        and t.age_class = player_registrations.age_class
    )
  )
  with check (
    exists (
      select 1 from players p
      where p.uuid = player_registrations.player_uuid
        and user_is_club_member(p.club_id)
    )
    and exists (
      select 1 from user_team_assignments uta
      join teams t on t.id = uta.team_id
      where uta.user_id = auth.uid()
        and t.gender = player_registrations.gender
        and t.age_class = player_registrations.age_class
    )
  );

-- === event_log ===
drop policy if exists "auth read" on event_log;
drop policy if exists "auth insert" on event_log;

create policy "club read" on event_log for select to authenticated
  using (user_is_club_member(club_id));

create policy "club insert" on event_log for insert to authenticated
  with check (user_is_club_member(club_id));

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

-- Add league info columns to teams
alter table teams add column if not exists league_class text;
alter table teams add column if not exists league text;
alter table teams add column if not exists league_group text;

-- Create matches table
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  match_date date not null,
  match_time time,
  is_home boolean not null default false,
  home_team text not null,
  away_team text not null,
  match_number text,
  location text,
  created_at timestamptz not null default now()
);

-- RLS for matches
alter table matches enable row level security;

create policy "Authenticated users can read matches"
  on matches for select
  to authenticated
  using (user_is_club_member(club_id));

create policy "Admins can insert matches"
  on matches for insert
  to authenticated
  with check (
    user_is_club_member(club_id) and
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update matches"
  on matches for update
  to authenticated
  using (
    user_is_club_member(club_id) and
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete matches"
  on matches for delete
  to authenticated
  using (
    user_is_club_member(club_id) and
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Index to support common access patterns (filter by club_id + team_id, order by date/time)
create index if not exists matches_club_team_date_time_idx
  on matches (club_id, team_id, match_date, match_time);

-- Index for captain lookups by team_id (PK is user_id, team_id so team_id-only queries need this)
create index if not exists idx_user_team_assignments_team
  on user_team_assignments (team_id);

-- Index for registration queries that filter by gender + age_class without player_uuid
create index if not exists idx_player_registrations_gender_age
  on player_registrations (gender, age_class);

-- Index for queries filtering club_id + deleted_at without gender (e.g. importSkillLevels, duplicate checks)
create index if not exists idx_players_club_deleted
  on players (club_id) where deleted_at is null;

-- Update event_log check constraint to include new event types
alter table event_log drop constraint if exists event_log_event_type_check;
alter table event_log add constraint event_log_event_type_check
  check (event_type in ('reorder', 'register', 'unregister', 'create', 'update', 'delete', 'csv_import', 'csv_bulk_delete', 'lk_import', 'schedule_import'));

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

-- Members, Events & RSVP system

-- ─── Members ───

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  email text,
  player_uuid uuid references players(uuid) on delete set null,
  created_at timestamptz not null default now()
);

create unique index idx_members_club_email on members (club_id, email) where email is not null;
create index idx_members_club on members (club_id);
create index idx_members_user on members (user_id) where user_id is not null;

alter table members enable row level security;

create policy "Club members can read members"
  on members for select to authenticated
  using (user_is_club_member(club_id));

create policy "Admins can insert members"
  on members for insert to authenticated
  with check (
    user_is_club_member(club_id) and
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update members"
  on members for update to authenticated
  using (
    user_is_club_member(club_id) and
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete members"
  on members for delete to authenticated
  using (
    user_is_club_member(club_id) and
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- ─── Member Team Assignments ───

create table if not exists member_team_assignments (
  member_id uuid not null references members(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, team_id)
);

create index idx_member_team_team on member_team_assignments (team_id);

alter table member_team_assignments enable row level security;

create policy "Club members can read member team assignments"
  on member_team_assignments for select to authenticated
  using (
    exists (select 1 from members m where m.id = member_id and user_is_club_member(m.club_id))
  );

create policy "Admins can manage member team assignments"
  on member_team_assignments for insert to authenticated
  with check (
    exists (
      select 1 from members m
      where m.id = member_id and user_is_club_member(m.club_id)
      and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
    )
  );

create policy "Admins can delete member team assignments"
  on member_team_assignments for delete to authenticated
  using (
    exists (
      select 1 from members m
      where m.id = member_id and user_is_club_member(m.club_id)
      and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
    )
  );

create policy "Captains can insert member team assignments for their teams"
  on member_team_assignments for insert to authenticated
  with check (
    exists (
      select 1 from members m
      where m.id = member_id and user_is_club_member(m.club_id)
      and exists (select 1 from user_team_assignments where user_id = auth.uid() and team_id = member_team_assignments.team_id)
    )
  );

create policy "Captains can delete member team assignments for their teams"
  on member_team_assignments for delete to authenticated
  using (
    exists (
      select 1 from members m
      where m.id = member_id and user_is_club_member(m.club_id)
      and exists (select 1 from user_team_assignments where user_id = auth.uid() and team_id = member_team_assignments.team_id)
    )
  );

-- ─── Invite Token on Teams ───

alter table teams add column if not exists invite_token text unique;

-- ─── Events ───

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  title text not null,
  description text,
  location text,
  event_type text not null default 'custom' check (event_type in ('match', 'training', 'social', 'custom')),
  recurrence_type text not null default 'none' check (recurrence_type in ('none', 'weekly', 'biweekly', 'monthly')),
  recurrence_day_of_week smallint check (recurrence_day_of_week between 0 and 6),
  recurrence_end_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_events_club on events (club_id);
create index idx_events_team on events (team_id) where team_id is not null;

alter table events enable row level security;

create policy "Club members can read events"
  on events for select to authenticated
  using (user_is_club_member(club_id));

create policy "Admins can manage all events"
  on events for all to authenticated
  using (
    user_is_club_member(club_id) and
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    user_is_club_member(club_id) and
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "Captains can manage team events"
  on events for all to authenticated
  using (
    team_id is not null and
    user_is_club_member(club_id) and
    exists (select 1 from user_team_assignments where user_id = auth.uid() and team_id = events.team_id)
  )
  with check (
    team_id is not null and
    user_is_club_member(club_id) and
    exists (select 1 from user_team_assignments where user_id = auth.uid() and team_id = events.team_id)
  );

-- ─── Event Occurrences ───

create table if not exists event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  start_date date not null,
  start_time time,
  end_time time,
  cancelled boolean not null default false,
  notes text,
  match_id uuid references matches(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_event_occurrences_event on event_occurrences (event_id);
create index idx_event_occurrences_date on event_occurrences (start_date);
create index idx_event_occurrences_match on event_occurrences (match_id) where match_id is not null;

alter table event_occurrences enable row level security;

create policy "Club members can read event occurrences"
  on event_occurrences for select to authenticated
  using (
    exists (select 1 from events e where e.id = event_id and user_is_club_member(e.club_id))
  );

create policy "Admins can manage all event occurrences"
  on event_occurrences for all to authenticated
  using (
    exists (
      select 1 from events e where e.id = event_id and user_is_club_member(e.club_id)
      and exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
    )
  );

create policy "Captains can manage team event occurrences"
  on event_occurrences for all to authenticated
  using (
    exists (
      select 1 from events e where e.id = event_id and e.team_id is not null
      and user_is_club_member(e.club_id)
      and exists (select 1 from user_team_assignments where user_id = auth.uid() and team_id = e.team_id)
    )
  );

-- ─── Event Responses (RSVP) ───

create table if not exists event_responses (
  id uuid primary key default gen_random_uuid(),
  event_occurrence_id uuid not null references event_occurrences(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  response text not null check (response in ('yes', 'no', 'maybe')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_occurrence_id, member_id)
);

create index idx_event_responses_occurrence on event_responses (event_occurrence_id);
create index idx_event_responses_member on event_responses (member_id);

alter table event_responses enable row level security;

create policy "Club members can read event responses"
  on event_responses for select to authenticated
  using (
    exists (
      select 1 from event_occurrences eo
      join events e on e.id = eo.event_id
      where eo.id = event_occurrence_id and user_is_club_member(e.club_id)
    )
  );

create policy "Members can insert own responses"
  on event_responses for insert to authenticated
  with check (
    exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid())
  );

create policy "Members can update own responses"
  on event_responses for update to authenticated
  using (
    exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid())
  );

create policy "Members can delete own responses"
  on event_responses for delete to authenticated
  using (
    exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid())
  );

-- ─── Update event_log constraint ───

alter table event_log drop constraint if exists event_log_event_type_check;
alter table event_log add constraint event_log_event_type_check
  check (event_type in (
    'reorder', 'register', 'unregister', 'create', 'update', 'delete',
    'csv_import', 'csv_bulk_delete', 'lk_import', 'schedule_import',
    'member_import', 'member_register', 'event_create', 'event_update', 'event_delete',
    'rsvp'
  ));

-- ─── Backfill: create member records for existing captains ───

insert into members (club_id, user_id, first_name, last_name, email)
select distinct uc.club_id, up.id,
  split_part(coalesce(u.raw_user_meta_data->>'full_name', u.email), ' ', 1),
  coalesce(
    nullif(
      substring(coalesce(u.raw_user_meta_data->>'full_name', '') from position(' ' in coalesce(u.raw_user_meta_data->>'full_name', '')) + 1),
      ''
    ),
    split_part(u.email, '@', 1)
  ),
  u.email
from user_profiles up
join auth.users u on u.id = up.id
join user_clubs uc on uc.user_id = up.id
where up.role in ('admin', 'captain')
on conflict do nothing;

-- Prevent cross-club member-team assignments via trigger
create or replace function check_member_team_same_club()
returns trigger as $$
begin
  if not exists (
    select 1
    from members m
    join teams t on t.club_id = m.club_id
    where m.id = NEW.member_id and t.id = NEW.team_id
  ) then
    raise exception 'Member and team must belong to the same club';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_member_team_same_club
  before insert or update on member_team_assignments
  for each row execute function check_member_team_same_club();

-- Drop unique email constraint on members.
-- Families in clubs often share the same email address (e.g. 4 family members
-- with one shared email). The member-to-player mapping uses name + birth_date,
-- not email, so uniqueness on email serves no functional purpose.

drop index if exists idx_members_club_email;
create index idx_members_club_email on members (club_id, email) where email is not null;

-- Add personal fields to user_profiles (user-managed profile data)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- External member ID for matching on re-imports
ALTER TABLE members ADD COLUMN IF NOT EXISTS external_id text;

-- Unique per club to allow upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_club_external_id
  ON members (club_id, external_id) WHERE external_id IS NOT NULL;

-- Track how a member record was created
ALTER TABLE members ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'import';

-- Consolidate user_team_assignments into member_team_assignments
-- Captain/player role now lives on the team assignment, not on user_profiles

-- ─── 1. Add role column to member_team_assignments ───

ALTER TABLE member_team_assignments
  ADD COLUMN role text NOT NULL DEFAULT 'player'
  CHECK (role IN ('player', 'captain'));

-- ─── 2. Match captains to existing members by email and migrate assignments ───

INSERT INTO member_team_assignments (member_id, team_id, role)
SELECT m.id, uta.team_id, 'captain'
FROM user_team_assignments uta
JOIN auth.users u ON u.id = uta.user_id
JOIN teams t ON t.id = uta.team_id
JOIN members m ON m.email = u.email AND m.club_id = t.club_id
ON CONFLICT (member_id, team_id) DO UPDATE SET role = 'captain';

-- Also set member.user_id for matched captains (may have been imported without user link)
UPDATE members m SET user_id = u.id
FROM user_team_assignments uta
JOIN auth.users u ON u.id = uta.user_id
JOIN teams t ON t.id = uta.team_id
WHERE m.email = u.email AND m.club_id = t.club_id
  AND m.user_id IS NULL;

-- ─── 3. Fallback: create members for captains not matched by email ───

INSERT INTO members (club_id, user_id, first_name, last_name, email)
SELECT DISTINCT t.club_id, uta.user_id,
  COALESCE(NULLIF(up.first_name, ''), split_part(u.email, '@', 1)),
  COALESCE(NULLIF(up.last_name, ''), ''),
  u.email
FROM user_team_assignments uta
JOIN user_profiles up ON up.id = uta.user_id
JOIN auth.users u ON u.id = up.id
JOIN teams t ON t.id = uta.team_id
WHERE NOT EXISTS (
  SELECT 1 FROM members m WHERE m.user_id = uta.user_id AND m.club_id = t.club_id
)
ON CONFLICT DO NOTHING;

-- Insert captain assignments for the fallback members
INSERT INTO member_team_assignments (member_id, team_id, role)
SELECT m.id, uta.team_id, 'captain'
FROM user_team_assignments uta
JOIN teams t ON t.id = uta.team_id
JOIN members m ON m.user_id = uta.user_id AND m.club_id = t.club_id
ON CONFLICT (member_id, team_id) DO UPDATE SET role = 'captain';

-- ─── 4. Helper function for RLS captain checks ───

CREATE OR REPLACE FUNCTION user_is_captain_of_team(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_team_assignments mta
    JOIN members m ON m.id = mta.member_id
    WHERE m.user_id = auth.uid()
      AND mta.team_id = p_team_id
      AND mta.role = 'captain'
  );
$$;

-- ─── 5. Replace RLS policies that reference user_team_assignments ───

-- 5a. players: captain access own teams (latest version from 20260305000000)
DROP POLICY IF EXISTS "captain access own teams" ON players;
CREATE POLICY "captain access own teams" ON players FOR ALL TO authenticated
  USING (
    user_is_club_member(club_id)
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND CASE
          WHEN t.age_class LIKE 'u%' THEN
            (extract(year FROM current_date) - extract(year FROM players.birth_date))
              <= CASE t.age_class
                WHEN 'u9' THEN 9 WHEN 'u10' THEN 10 WHEN 'u12' THEN 12
                WHEN 'u15' THEN 15 WHEN 'u18' THEN 18
              END
            AND (
              t.age_class IN ('u9','u10','u12')
              OR (t.gender = 'female' AND players.gender = 'female')
              OR t.gender = 'male'
            )
          WHEN t.age_class = 'all' THEN
            t.gender = players.gender
          ELSE
            t.gender = players.gender
            AND (extract(year FROM current_date) - extract(year FROM players.birth_date)) >= t.age_class::int
        END
    )
  )
  WITH CHECK (
    user_is_club_member(club_id)
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND CASE
          WHEN t.age_class LIKE 'u%' THEN
            (extract(year FROM current_date) - extract(year FROM players.birth_date))
              <= CASE t.age_class
                WHEN 'u9' THEN 9 WHEN 'u10' THEN 10 WHEN 'u12' THEN 12
                WHEN 'u15' THEN 15 WHEN 'u18' THEN 18
              END
            AND (
              t.age_class IN ('u9','u10','u12')
              OR (t.gender = 'female' AND players.gender = 'female')
              OR t.gender = 'male'
            )
          WHEN t.age_class = 'all' THEN
            t.gender = players.gender
          ELSE
            t.gender = players.gender
            AND (extract(year FROM current_date) - extract(year FROM players.birth_date)) >= t.age_class::int
        END
    )
  );

-- 5b. player_registrations: captain access own teams (latest version from 20260302000000)
DROP POLICY IF EXISTS "captain access own teams" ON player_registrations;
CREATE POLICY "captain access own teams" ON player_registrations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_member(p.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND t.gender = player_registrations.gender
        AND t.age_class = player_registrations.age_class
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_member(p.club_id)
    )
    AND EXISTS (
      SELECT 1 FROM member_team_assignments mta
      JOIN members m ON m.id = mta.member_id
      JOIN teams t ON t.id = mta.team_id
      WHERE m.user_id = auth.uid()
        AND mta.role = 'captain'
        AND t.gender = player_registrations.gender
        AND t.age_class = player_registrations.age_class
    )
  );

-- 5c. member_team_assignments: captain insert/delete
DROP POLICY IF EXISTS "Captains can insert member team assignments for their teams" ON member_team_assignments;
CREATE POLICY "Captains can insert member team assignments for their teams"
  ON member_team_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_member(m.club_id)
    )
    AND user_is_captain_of_team(team_id)
  );

DROP POLICY IF EXISTS "Captains can delete member team assignments for their teams" ON member_team_assignments;
CREATE POLICY "Captains can delete member team assignments for their teams"
  ON member_team_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_member(m.club_id)
    )
    AND user_is_captain_of_team(team_id)
  );

-- 5d. events: captain manage team events
DROP POLICY IF EXISTS "Captains can manage team events" ON events;
CREATE POLICY "Captains can manage team events"
  ON events FOR ALL TO authenticated
  USING (
    team_id IS NOT NULL
    AND user_is_club_member(club_id)
    AND user_is_captain_of_team(team_id)
  )
  WITH CHECK (
    team_id IS NOT NULL
    AND user_is_club_member(club_id)
    AND user_is_captain_of_team(team_id)
  );

-- 5e. event_occurrences: captain manage team event occurrences
DROP POLICY IF EXISTS "Captains can manage team event occurrences" ON event_occurrences;
CREATE POLICY "Captains can manage team event occurrences"
  ON event_occurrences FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND e.team_id IS NOT NULL
      AND user_is_club_member(e.club_id)
      AND user_is_captain_of_team(e.team_id)
    )
  );

-- ─── 6. Update user_profiles role: captain/player → user ───

ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
UPDATE user_profiles SET role = 'user' WHERE role IN ('captain', 'player');
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'user'));
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'user';

-- ─── 7. Drop old table ───

DROP POLICY IF EXISTS "authenticated read" ON user_team_assignments;
DROP POLICY IF EXISTS "admin write" ON user_team_assignments;
DROP TABLE user_team_assignments;

-- ─── 8. Index for captain lookups ───

CREATE INDEX idx_member_team_role ON member_team_assignments (team_id, role)
  WHERE role = 'captain';

CREATE INDEX IF NOT EXISTS idx_players_skill_level ON public.players USING btree (skill_level);
-- Move role from user_profiles to user_clubs (per-club role)
-- Remove dead user_profiles.player_uuid column

-- ─── 1. Add role column to user_clubs ───

ALTER TABLE user_clubs
  ADD COLUMN role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- ─── 2. Migrate existing role data ───

UPDATE user_clubs uc
SET role = up.role
FROM user_profiles up
WHERE uc.user_id = up.id;

-- ─── 3. Create user_is_club_admin() helper ───

CREATE OR REPLACE FUNCTION user_is_club_admin(p_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_clubs
    WHERE user_id = auth.uid()
      AND club_id = p_club_id
      AND role = 'admin'
  );
$$;

-- ─── 4. Drop dead "player read own" policies ───

DROP POLICY IF EXISTS "player read own" ON players;
DROP POLICY IF EXISTS "player read own" ON player_registrations;

-- ─── 5. Replace admin RLS policies ───

-- 5a. players
DROP POLICY IF EXISTS "admin full access" ON players;
CREATE POLICY "admin full access" ON players FOR ALL TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id))
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5b. teams
DROP POLICY IF EXISTS "admin write" ON teams;
CREATE POLICY "admin write" ON teams FOR ALL TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id))
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5c. player_registrations
DROP POLICY IF EXISTS "admin write" ON player_registrations;
DROP POLICY IF EXISTS "admin full access" ON player_registrations;
CREATE POLICY "admin full access" ON player_registrations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_admin(p.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.uuid = player_registrations.player_uuid
        AND user_is_club_admin(p.club_id)
    )
  );

-- 5d. matches (3 policies)
DROP POLICY IF EXISTS "Admins can insert matches" ON matches;
CREATE POLICY "Admins can insert matches" ON matches FOR INSERT TO authenticated
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can update matches" ON matches;
CREATE POLICY "Admins can update matches" ON matches FOR UPDATE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can delete matches" ON matches;
CREATE POLICY "Admins can delete matches" ON matches FOR DELETE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5e. members (3 policies)
DROP POLICY IF EXISTS "Admins can insert members" ON members;
CREATE POLICY "Admins can insert members" ON members FOR INSERT TO authenticated
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can update members" ON members;
CREATE POLICY "Admins can update members" ON members FOR UPDATE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

DROP POLICY IF EXISTS "Admins can delete members" ON members;
CREATE POLICY "Admins can delete members" ON members FOR DELETE TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5f. member_team_assignments (2 policies)
DROP POLICY IF EXISTS "Admins can manage member team assignments" ON member_team_assignments;
CREATE POLICY "Admins can manage member team assignments"
  ON member_team_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_admin(m.club_id)
    )
  );

DROP POLICY IF EXISTS "Admins can delete member team assignments" ON member_team_assignments;
CREATE POLICY "Admins can delete member team assignments"
  ON member_team_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.id = member_id AND user_is_club_admin(m.club_id)
    )
  );

-- 5g. events
DROP POLICY IF EXISTS "Admins can manage all events" ON events;
CREATE POLICY "Admins can manage all events" ON events FOR ALL TO authenticated
  USING (user_is_club_member(club_id) AND user_is_club_admin(club_id))
  WITH CHECK (user_is_club_member(club_id) AND user_is_club_admin(club_id));

-- 5h. event_occurrences
DROP POLICY IF EXISTS "Admins can manage all event occurrences" ON event_occurrences;
CREATE POLICY "Admins can manage all event occurrences"
  ON event_occurrences FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id AND user_is_club_admin(e.club_id)
    )
  );

-- ─── 6. Admin management policy on user_clubs ───

CREATE POLICY "admin can manage club members" ON user_clubs FOR ALL TO authenticated
  USING (user_is_club_admin(club_id))
  WITH CHECK (user_is_club_admin(club_id));

-- ─── 7. Drop columns from user_profiles ───

ALTER TABLE user_profiles DROP COLUMN player_uuid;
ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE user_profiles DROP COLUMN role;

-- ─── 8. Index for admin lookups ───

CREATE INDEX idx_user_clubs_admin ON user_clubs (club_id, user_id) WHERE role = 'admin';

-- Match lineup planning for team captains

CREATE TABLE match_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_uuid uuid NOT NULL REFERENCES players(uuid) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_uuid)
);

CREATE INDEX idx_match_lineups_match ON match_lineups (match_id);
CREATE INDEX idx_match_lineups_player ON match_lineups (player_uuid);

ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;

-- All club members can read lineups
CREATE POLICY "Club members can read lineups"
  ON match_lineups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_club_member(m.club_id)
    )
  );

-- Admins can manage all lineups
CREATE POLICY "Admins can manage lineups"
  ON match_lineups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_club_admin(m.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_club_admin(m.club_id)
    )
  );

-- Captains can manage lineups for their team's matches
CREATE POLICY "Captains can manage team lineups"
  ON match_lineups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_captain_of_team(m.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND user_is_captain_of_team(m.team_id)
    )
  );

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


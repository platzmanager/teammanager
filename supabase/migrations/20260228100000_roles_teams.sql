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

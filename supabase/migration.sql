create extension if not exists "uuid-ossp";
create type gender_enum as enum ('damen', 'herren');

create table players (
  uuid uuid primary key default uuid_generate_v4(),
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

-- Teams table
create table teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  gender gender_enum not null,
  age_class text not null check (age_class in ('offen','30','40','50','60')),
  created_at timestamptz default now()
);

alter table teams enable row level security;
create policy "auth read" on teams for select to authenticated using (true);
create policy "admin write" on teams for all to authenticated
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- User profiles table
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'captain')) default 'captain',
  team_id uuid references teams(id) on delete set null,
  created_at timestamptz default now()
);

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

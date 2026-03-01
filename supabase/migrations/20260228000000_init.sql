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

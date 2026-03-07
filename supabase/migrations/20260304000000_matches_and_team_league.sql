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

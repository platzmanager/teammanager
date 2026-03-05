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
  using (true);

create policy "Admins can insert matches"
  on matches for insert
  to authenticated
  with check (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update matches"
  on matches for update
  to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete matches"
  on matches for delete
  to authenticated
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Update event_log check constraint to include new event types
alter table event_log drop constraint if exists event_log_event_type_check;
alter table event_log add constraint event_log_event_type_check
  check (event_type in ('reorder', 'register', 'unregister', 'create', 'update', 'delete', 'csv_import', 'csv_bulk_delete', 'lk_import', 'schedule_import'));

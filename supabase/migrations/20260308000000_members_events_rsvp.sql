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

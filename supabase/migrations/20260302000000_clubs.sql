-- Multi-tenancy: clubs
-- Adds club scoping to players, teams, and event_log.

-- 1. Create clubs table
create table clubs (
  id uuid primary key default uuid_generate_v4(),
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

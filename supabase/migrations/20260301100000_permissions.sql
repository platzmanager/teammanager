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

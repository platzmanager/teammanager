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

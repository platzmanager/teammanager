-- Drop unique email constraint on members.
-- Families in clubs often share the same email address (e.g. 4 family members
-- with one shared email). The member-to-player mapping uses name + birth_date,
-- not email, so uniqueness on email serves no functional purpose.

drop index if exists idx_members_club_email;
create index idx_members_club_email on members (club_id, email) where email is not null;

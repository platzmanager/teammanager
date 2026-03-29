import { createClient } from "@/lib/supabase/server";
import { Gender, AgeClass, UserProfile, UserRole, Team, Member } from "@/lib/types";
import { getCurrentClubId } from "@/lib/club";

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("id, first_name, last_name, birth_date, created_at")
    .eq("id", user.id)
    .single();

  if (!profileData) return null;

  // Load club-scoped role and teams
  const clubId = await getCurrentClubId();
  let role: UserRole = "user";
  let teams: Team[] = [];
  let captainTeamIds: string[] = [];

  if (clubId) {
    const { data: ucData } = await supabase
      .from("user_clubs")
      .select("role")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();
    role = (ucData?.role as UserRole) ?? "user";

    const { data: memberData } = await supabase
      .from("members")
      .select("id, teams:member_team_assignments(role, team:teams(*))")
      .eq("user_id", user.id)
      .eq("club_id", clubId)
      .maybeSingle();

    const assignments = (memberData?.teams as unknown as { role: string; team: Team }[] | null) ?? [];
    teams = assignments.map((a) => a.team);
    captainTeamIds = assignments.filter((a) => a.role === "captain").map((a) => a.team.id);
  }

  return {
    id: profileData.id,
    role,
    first_name: profileData.first_name,
    last_name: profileData.last_name,
    birth_date: profileData.birth_date,
    teams,
    captainTeamIds,
    created_at: profileData.created_at,
  } as UserProfile;
}

export async function requireRole(): Promise<UserProfile> {
  const profile = await getUserProfile();
  if (!profile) throw new Error("Keine Berechtigung");
  return profile;
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireRole();
  if (profile.role !== "admin") throw new Error("Admin-Berechtigung erforderlich");
  return profile;
}

export function canAccessGender(profile: UserProfile, gender: Gender): boolean {
  if (profile.role === "admin") return true;
  return profile.teams?.some((t) => t.gender === gender) ?? false;
}

export function canAccessTeamScope(profile: UserProfile, gender: Gender, ageClass: AgeClass): boolean {
  if (profile.role === "admin") return true;
  return profile.teams?.some((t) => t.gender === gender && t.age_class === ageClass) ?? false;
}

export function getUserAgeClasses(profile: UserProfile, gender: Gender): AgeClass[] {
  if (profile.role === "admin") return ["all", "30", "40", "50", "60", "u9", "u10", "u12", "u15", "u18"];
  const ageClasses = new Set<AgeClass>();
  profile.teams?.forEach((t) => {
    if (t.gender === gender) ageClasses.add(t.age_class);
  });
  return (["all", "30", "40", "50", "60", "u9", "u10", "u12", "u15", "u18"] as AgeClass[]).filter((ac) => ageClasses.has(ac));
}

export function getDefaultPath(profile: UserProfile, clubSlug: string): string {
  return `/${clubSlug}/teams`;
}

export function getUserGenders(profile: UserProfile): Gender[] {
  if (profile.role === "admin") return ["female", "male"];
  const genders = new Set<Gender>();
  profile.teams?.forEach((t) => genders.add(t.gender));
  return Array.from(genders);
}

export function getUserTeamScopes(profile: UserProfile): { gender: Gender; age_class: AgeClass }[] {
  if (profile.role === "admin") return [];
  return (profile.teams ?? []).map((t) => ({ gender: t.gender, age_class: t.age_class }));
}

export async function getMemberForUser(): Promise<Member | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const clubId = await getCurrentClubId();
  if (!clubId) return null;

  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data as Member | null;
}

export async function getMemberTeamIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const clubId = await getCurrentClubId();
  if (!clubId) return [];

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return [];

  const { data: assignments } = await supabase
    .from("member_team_assignments")
    .select("team_id")
    .eq("member_id", member.id);

  return (assignments ?? []).map((a) => a.team_id);
}

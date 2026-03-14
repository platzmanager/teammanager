import { createClient } from "@/lib/supabase/server";
import { Gender, AgeClass, UserProfile, Team, Member } from "@/lib/types";
import { getCurrentClubId } from "@/lib/club";

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("*, teams:user_team_assignments(team:teams(*))")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  const teams: Team[] = (data.teams as { team: Team }[] | null)?.map((t) => t.team) ?? [];

  return {
    id: data.id,
    role: data.role,
    player_uuid: data.player_uuid,
    teams,
    created_at: data.created_at,
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

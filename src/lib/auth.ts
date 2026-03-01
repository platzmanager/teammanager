import { createClient } from "@/lib/supabase/server";
import { Gender, AgeClass, UserProfile, Team } from "@/lib/types";

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

  // Flatten nested join: [{team: {…}}] → Team[]
  const teams: Team[] = (data.teams as { team: Team }[] | null)?.map((t) => t.team) ?? [];

  return {
    id: data.id,
    role: data.role,
    team_id: data.team_id,
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
  // Captains cannot access "offen" — they must use specific age classes
  if (ageClass === "offen") return false;
  return profile.teams?.some((t) => t.gender === gender && t.age_class === ageClass) ?? false;
}

export function getUserAgeClasses(profile: UserProfile, gender: Gender): AgeClass[] {
  if (profile.role === "admin") return ["offen", "30", "40", "50", "60"];
  const ageClasses = new Set<AgeClass>();
  profile.teams?.forEach((t) => {
    if (t.gender === gender) ageClasses.add(t.age_class);
  });
  return (["30", "40", "50", "60"] as AgeClass[]).filter((ac) => ageClasses.has(ac));
}

function ageClassToUrl(ac: AgeClass): string {
  return ac === "offen" ? "all" : ac;
}

export function getDefaultPath(profile: UserProfile): string {
  const genders = getUserGenders(profile);
  if (genders.length === 0) return "/female/all";
  const gender = genders[0];
  if (profile.role === "admin") return `/${gender}/all`;
  const ageClasses = getUserAgeClasses(profile, gender);
  return `/${gender}/${ageClassToUrl(ageClasses[0] ?? "offen")}`;
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

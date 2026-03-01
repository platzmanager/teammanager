import { createClient } from "@/lib/supabase/server";
import { UserProfile } from "@/lib/types";

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("*, team:teams(*)")
    .eq("id", user.id)
    .single();

  return data as UserProfile | null;
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

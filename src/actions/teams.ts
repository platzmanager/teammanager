"use server";

import { requireAdmin, getUserProfile } from "@/lib/auth";
import { Gender, AgeClass, Team, UserProfile } from "@/lib/types";
import { withClubContext } from "@/lib/club";
import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getSessionProfile(): Promise<UserProfile | null> {
  return getUserProfile();
}

export async function getTeams() {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("teams").select("*").eq("club_id", clubId)
      .order("gender").order("age_class").order("rank");
    if (error) throw error;
    return data as Team[];
  });
}

export async function getTeamBySlug(gender: Gender, slug: string): Promise<Team | null> {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("club_id", clubId)
      .eq("gender", gender)
      .eq("slug", slug)
      .single();
    if (error) return null;
    return data as Team;
  });
}

async function generateSlug(supabase: SupabaseClient, clubId: string, gender: Gender, ageClass: AgeClass): Promise<string> {
  const { data: existing } = await supabase
    .from("teams")
    .select("slug")
    .eq("club_id", clubId)
    .eq("gender", gender)
    .like("slug", `${ageClass}%`);

  const usedSlugs = new Set((existing ?? []).map((t: { slug: string }) => t.slug));

  if (!usedSlugs.has(ageClass)) return ageClass;

  let i = 2;
  while (usedSlugs.has(`${ageClass}-${i}`)) i++;
  return `${ageClass}-${i}`;
}

export async function getNextRank(gender: Gender, ageClass: AgeClass): Promise<number> {
  return withClubContext(async (supabase, clubId) => {
    const { data } = await supabase
      .from("teams")
      .select("rank")
      .eq("club_id", clubId)
      .eq("gender", gender)
      .eq("age_class", ageClass)
      .order("rank", { ascending: false })
      .limit(1);
    return (data?.[0]?.rank ?? 0) + 1;
  });
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  return withClubContext(async (supabase, clubId) => {
    const gender = formData.get("gender") as Gender;
    const ageClass = formData.get("age_class") as AgeClass;
    const slug = await generateSlug(supabase, clubId, gender, ageClass);

    const teamSize = parseInt(formData.get("team_size") as string) || 6;

    // Auto-assign next rank for this group
    const { data: existing } = await supabase
      .from("teams")
      .select("rank")
      .eq("club_id", clubId)
      .eq("gender", gender)
      .eq("age_class", ageClass)
      .order("rank", { ascending: false })
      .limit(1);
    const nextRank = (existing?.[0]?.rank ?? 0) + 1;

    const { error } = await supabase.from("teams").insert({
      name: formData.get("name") as string,
      gender,
      age_class: ageClass,
      slug,
      club_id: clubId,
      team_size: teamSize,
      rank: nextRank,
    });
    if (error) throw error;
  });
}

export async function updateTeam(formData: FormData) {
  await requireAdmin();
  return withClubContext(async (supabase, clubId) => {
    const id = formData.get("id") as string;
    const teamSize = parseInt(formData.get("team_size") as string) || 6;
    const rankStr = formData.get("rank") as string | null;
    const update: Record<string, unknown> = {
      name: formData.get("name") as string,
      gender: formData.get("gender") as Gender,
      age_class: formData.get("age_class") as AgeClass,
      team_size: teamSize,
    };
    if (rankStr) {
      const parsedRank = parseInt(rankStr, 10);
      if (Number.isFinite(parsedRank) && parsedRank >= 1) {
        update.rank = parsedRank;
      }
    }
    const { error } = await supabase.from("teams").update(update).eq("id", id).eq("club_id", clubId);
    if (error) throw error;
  });
}

export async function getBlockedCount(team: Team): Promise<number> {
  return withClubContext(async (supabase) => {
    const { data, error } = await supabase
      .from("teams")
      .select("team_size")
      .eq("club_id", team.club_id)
      .eq("gender", team.gender)
      .eq("age_class", team.age_class)
      .lt("rank", team.rank);
    if (error) throw error;
    return (data ?? []).reduce((sum: number, t: { team_size: number }) => sum + t.team_size, 0);
  });
}

export async function deleteTeam(id: string) {
  await requireAdmin();
  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase.from("teams").delete().eq("id", id).eq("club_id", clubId);
    if (error) throw error;
  });
}

// Captain management

export async function getTeamCaptains(teamId: string): Promise<{ id: string; email: string }[]> {
  return withClubContext(async (supabase) => {
    const { data, error } = await supabase
      .from("user_team_assignments")
      .select("user_id")
      .eq("team_id", teamId);
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const admin = createAdminClient();
    const captains = await Promise.all(
      data.map(async (d: { user_id: string }) => {
        const { data: { user } } = await admin.auth.admin.getUserById(d.user_id);
        return { id: d.user_id, email: user?.email ?? d.user_id };
      }),
    );
    return captains;
  });
}

export async function addCaptain(teamId: string, userId: string) {
  await requireAdmin();
  return withClubContext(async (supabase) => {
    const { error } = await supabase
      .from("user_team_assignments")
      .insert({ user_id: userId, team_id: teamId });
    if (error) throw error;
  });
}

export async function inviteCaptain(teamId: string, email: string): Promise<{ id: string; email: string }> {
  await requireAdmin();
  return withClubContext(async (supabase, clubId) => {
    const admin = createAdminClient();

    // Find or invite user
    let userId: string;
    const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.find((u) => u.email === email);

    if (existing) {
      userId = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
      if (error) throw error;
      userId = data.user.id;
    }

    // Use admin client for inserts — RLS would block writing rows for another user
    // Upsert user_profiles (don't overwrite existing)
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!existingProfile) {
      const { error: profileError } = await admin.from("user_profiles").insert({ id: userId, role: "captain" });
      if (profileError) throw new Error("Profil konnte nicht erstellt werden");
    }

    // Upsert team assignment
    const { error: assignmentError } = await admin
      .from("user_team_assignments")
      .upsert({ user_id: userId, team_id: teamId }, { onConflict: "user_id,team_id" });
    if (assignmentError) throw new Error("Team-Zuordnung fehlgeschlagen");

    // Upsert club membership
    const { error: clubError } = await admin
      .from("user_clubs")
      .upsert({ user_id: userId, club_id: clubId }, { onConflict: "user_id,club_id" });
    if (clubError) throw new Error("Vereins-Zuordnung fehlgeschlagen");

    return { id: userId, email };
  });
}

export async function getRegisteredPlayers(gender: Gender, ageClass: AgeClass) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("player_registrations")
      .select("player_uuid, players!inner(uuid, first_name, last_name, skill_level, birth_date, sort_position, license, deleted_at)")
      .eq("gender", gender)
      .eq("age_class", ageClass)
      .eq("players.club_id", clubId)
      .is("players.deleted_at", null);

    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players = (data ?? []).map((r: any) => r.players as import("@/lib/types").Player);

    const { sortPlayers } = await import("@/lib/players");
    return sortPlayers(players);
  });
}

/** Returns a map of `gender:age_class` → total registered player count */
export async function getRegistrationCounts(): Promise<Record<string, number>> {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("player_registrations")
      .select("gender, age_class, players!inner(uuid)")
      .eq("players.club_id", clubId)
      .is("players.deleted_at", null);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const key = `${row.gender}:${row.age_class}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  });
}

export async function removeCaptain(teamId: string, userId: string) {
  await requireAdmin();
  return withClubContext(async (supabase) => {
    const { error } = await supabase
      .from("user_team_assignments")
      .delete()
      .eq("user_id", userId)
      .eq("team_id", teamId);
    if (error) throw error;
  });
}

export async function getTeamMatches(teamId: string) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("team_id", teamId)
      .eq("club_id", clubId)
      .order("match_date")
      .order("match_time");
    if (error) throw error;
    return (data ?? []) as import("@/lib/types").Match[];
  });
}

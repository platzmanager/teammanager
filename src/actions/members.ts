"use server";

import { requireAdmin, requireRole } from "@/lib/auth";
import { withClubContext } from "@/lib/club";
import { createAdminClient } from "@/lib/supabase/admin";
import { Member } from "@/lib/types";
import { revalidatePath } from "next/cache";

export async function getMembers() {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("members")
      .select("*, teams:member_team_assignments(team:teams(id, name))")
      .eq("club_id", clubId)
      .order("last_name")
      .order("first_name");
    if (error) throw error;
    return data as (Member & { teams: { team: { id: string; name: string } }[] })[];
  });
}

interface ImportMember {
  external_id?: string;
  first_name: string;
  last_name: string;
  birth_date?: string;
  email?: string;
}

export async function importMembers(members: ImportMember[]) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { data: { user } } = await supabase.auth.getUser();

    const skipped: { row: number; name: string; reason: string }[] = [];
    const valid: ImportMember[] = [];

    // Fetch existing members for duplicate checking
    const { data: allExisting } = await supabase
      .from("members")
      .select("first_name, last_name, email, external_id")
      .eq("club_id", clubId);

    const existingNameSet = new Set(
      (allExisting ?? []).map(
        (e) => `${e.first_name.toLowerCase()}|${e.last_name.toLowerCase()}`
      )
    );
    const existingExtIds = new Set(
      (allExisting ?? []).filter((e) => e.external_id).map((e) => e.external_id)
    );

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || `Zeile ${i + 1}`;
      if (!m.first_name) { skipped.push({ row: i + 1, name, reason: "Vorname fehlt" }); continue; }
      if (!m.last_name) { skipped.push({ row: i + 1, name, reason: "Nachname fehlt" }); continue; }

      // Members with external_id are always valid (upsert)
      if (m.external_id) {
        valid.push(m);
        continue;
      }

      const key = `${m.first_name.toLowerCase()}|${m.last_name.toLowerCase()}`;
      if (existingNameSet.has(key)) {
        skipped.push({ row: i + 1, name, reason: "Mitglied existiert bereits" });
        continue;
      }

      existingNameSet.add(key);
      valid.push(m);
    }

    // Auto-match players by exact name + birthdate
    const { data: allPlayers } = await supabase
      .from("players")
      .select("uuid, first_name, last_name, birth_date")
      .eq("club_id", clubId)
      .is("deleted_at", null);

    const playerMap = new Map<string, string>();
    for (const p of allPlayers ?? []) {
      const key = `${p.first_name.toLowerCase()}|${p.last_name.toLowerCase()}|${p.birth_date}`;
      playerMap.set(key, p.uuid);
    }

    const upsertRows: Record<string, unknown>[] = [];
    const insertRows: Record<string, unknown>[] = [];

    for (const m of valid) {
      let birthDate = m.birth_date || null;
      if (birthDate) {
        const dotMatch = birthDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (dotMatch) {
          birthDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
        }
      }

      let playerUuid: string | null = null;
      if (birthDate) {
        const key = `${m.first_name.toLowerCase()}|${m.last_name.toLowerCase()}|${birthDate}`;
        playerUuid = playerMap.get(key) ?? null;
      }

      const row = {
        external_id: m.external_id || null,
        first_name: m.first_name,
        last_name: m.last_name,
        birth_date: birthDate,
        email: m.email || null,
        player_uuid: playerUuid,
        club_id: clubId,
      };

      if (m.external_id && existingExtIds.has(m.external_id)) {
        upsertRows.push(row);
      } else {
        insertRows.push(row);
      }
    }

    let inserted = 0;
    let updated = 0;

    if (upsertRows.length > 0) {
      const { error } = await supabase
        .from("members")
        .upsert(upsertRows, { onConflict: "club_id,external_id" });
      if (error) {
        console.error("Member upsert error:", JSON.stringify(error, null, 2));
        throw new Error("Datenbankfehler beim Upsert. Bitte Daten prüfen.");
      }
      updated = upsertRows.length;
    }

    if (insertRows.length > 0) {
      const { error } = await supabase.from("members").insert(insertRows);
      if (error) {
        console.error("Member import error:", JSON.stringify(error, null, 2));
        throw new Error("Datenbankfehler beim Import. Bitte Daten prüfen.");
      }
      inserted = insertRows.length;
    }

    await supabase.from("event_log").insert({
      event_type: "member_import",
      gender: "male",
      details: { inserted, updated, total: members.length },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/", "layout");

    return { count: inserted + updated, inserted, updated, total: members.length, skipped };
  });
}

export async function linkMemberToPlayer(memberId: string, playerUuid: string) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase
      .from("members")
      .update({ player_uuid: playerUuid })
      .eq("id", memberId)
      .eq("club_id", clubId);
    if (error) throw error;

    revalidatePath("/", "layout");
  });
}

export async function getUnmatchedMembers() {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("club_id", clubId)
      .is("player_uuid", null)
      .order("last_name")
      .order("first_name");
    if (error) throw error;
    return data as Member[];
  });
}

export async function generateInviteToken(teamId: string) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    const isAdmin = profile.role === "admin";
    const isCaptain = profile.teams?.some((t) => t.id === teamId) ?? false;
    if (!isAdmin && !isCaptain) throw new Error("Keine Berechtigung");

    const admin = createAdminClient();
    const token = crypto.randomUUID();
    const { error, count } = await admin
      .from("teams")
      .update({ invite_token: token })
      .eq("id", teamId)
      .eq("club_id", clubId);
    if (error) throw error;
    if (count === 0) throw new Error("Team nicht gefunden");

    revalidatePath("/", "layout");
    return token;
  });
}

export async function revokeInviteToken(teamId: string) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    const isAdmin = profile.role === "admin";
    const isCaptain = profile.teams?.some((t) => t.id === teamId) ?? false;
    if (!isAdmin && !isCaptain) throw new Error("Keine Berechtigung");

    const admin = createAdminClient();
    const { error } = await admin
      .from("teams")
      .update({ invite_token: null })
      .eq("id", teamId)
      .eq("club_id", clubId);
    if (error) throw error;

    revalidatePath("/", "layout");
  });
}

export async function getTeamByInviteToken(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .select("*, club:clubs(id, name, slug)")
    .eq("invite_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function registerViaInvite(
  token: string,
  formData: { first_name: string; last_name: string; birth_date: string; email: string; password: string }
) {
  // Server-side validation
  if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
    throw new Error("Vor- und Nachname sind erforderlich");
  }
  if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    throw new Error("Ungültige E-Mail-Adresse");
  }
  if (!formData.password || formData.password.length < 6) {
    throw new Error("Passwort muss mindestens 6 Zeichen lang sein");
  }

  const admin = createAdminClient();

  // Look up team by token
  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id, club_id")
    .eq("invite_token", token)
    .maybeSingle();
  if (teamError || !team) throw new Error("Ungültiger Einladungslink");

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
  });
  if (authError) {
    if (authError.message?.includes("already been registered")) {
      throw new Error("Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.");
    }
    throw new Error("Registrierung fehlgeschlagen: " + authError.message);
  }

  const userId = authData.user.id;

  const rollbackAuthUser = async () => {
    try { await admin.auth.admin.deleteUser(userId); } catch { /* ignore */ }
  };

  // Normalize birth_date
  let birthDate = formData.birth_date;
  const dotMatch = birthDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    birthDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
  }

  // Create user profile with personal data
  const { error: profileError } = await admin
    .from("user_profiles")
    .insert({
      id: userId,
      role: "player",
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      birth_date: birthDate,
    });
  if (profileError) { await rollbackAuthUser(); throw new Error("Profil konnte nicht erstellt werden"); }

  // Create club membership
  const { error: clubError } = await admin
    .from("user_clubs")
    .upsert({ user_id: userId, club_id: team.club_id }, { onConflict: "user_id,club_id" });
  if (clubError) { await rollbackAuthUser(); throw new Error("Vereins-Zuordnung fehlgeschlagen"); }

  // Try to find and link existing member (by email or name+birth_date)
  const { data: existingMember } = await admin
    .from("members")
    .select("id, player_uuid")
    .eq("club_id", team.club_id)
    .is("user_id", null)
    .or(`email.ilike.${formData.email},and(first_name.ilike.${formData.first_name.trim()},last_name.ilike.${formData.last_name.trim()},birth_date.eq.${birthDate})`)
    .limit(1)
    .maybeSingle();

  if (existingMember) {
    // Link user to existing member
    await admin
      .from("members")
      .update({ user_id: userId })
      .eq("id", existingMember.id);

    // Create team assignment
    await admin
      .from("member_team_assignments")
      .upsert({ member_id: existingMember.id, team_id: team.id }, { onConflict: "member_id,team_id" });
  }

  // Log
  await admin.from("event_log").insert({
    event_type: "member_register",
    gender: "male",
    details: {
      member_id: existingMember?.id ?? null,
      team_id: team.id,
      linked: !!existingMember,
    },
    user_id: userId,
    club_id: team.club_id,
  });

  return { success: true };
}

export async function getUnlinkedUsers() {
  await requireAdmin();
  return withClubContext(async (supabase, clubId) => {
    // Get all user_ids already linked to a member in this club
    const { data: linkedMembers } = await supabase
      .from("members")
      .select("user_id")
      .eq("club_id", clubId)
      .not("user_id", "is", null);

    const linkedSet = new Set((linkedMembers ?? []).map((m) => m.user_id));

    // Get all users in this club
    const { data: clubUsers } = await supabase
      .from("user_clubs")
      .select("user_id")
      .eq("club_id", clubId);

    const unlinkedUserIds = (clubUsers ?? [])
      .map((u) => u.user_id)
      .filter((id) => !linkedSet.has(id));

    if (unlinkedUserIds.length === 0) return [];

    // Fetch their profiles
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, birth_date, role")
      .in("id", unlinkedUserIds);

    return (profiles ?? []).filter((p) => p.role === "player");
  });
}

export async function linkUserToMember(userId: string, memberId: string) {
  await requireAdmin();
  return withClubContext(async (supabase, clubId) => {
    // Verify member belongs to this club and has no user_id yet
    const { data: member } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("id", memberId)
      .eq("club_id", clubId)
      .single();

    if (!member) throw new Error("Mitglied nicht gefunden");
    if (member.user_id) throw new Error("Mitglied ist bereits verknüpft");

    // Verify user belongs to this club
    const { data: userClub } = await supabase
      .from("user_clubs")
      .select("user_id")
      .eq("user_id", userId)
      .eq("club_id", clubId)
      .maybeSingle();

    if (!userClub) throw new Error("User gehört nicht zu diesem Verein");

    const { error } = await supabase
      .from("members")
      .update({ user_id: userId })
      .eq("id", memberId)
      .eq("club_id", clubId);

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

export async function searchPlayers(query: string) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("players")
      .select("uuid, first_name, last_name, birth_date")
      .eq("club_id", clubId)
      .is("deleted_at", null)
      .or(`first_name.ilike.%${query.replace(/[%_\\]/g, "\\$&")}%,last_name.ilike.%${query.replace(/[%_\\]/g, "\\$&")}%`)
      .order("last_name")
      .limit(20);
    if (error) throw error;
    return data;
  });
}

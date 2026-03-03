"use server";

import { revalidatePath } from "next/cache";
import { Gender, AgeClass } from "@/lib/types";
import { requireRole, requireAdmin, canAccessGender } from "@/lib/auth";
import { withClubContext } from "@/lib/club";

export async function getPlayers(gender: Gender) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("gender", gender)
      .eq("club_id", clubId)
      .order("skill_level", { ascending: true })
      .order("sort_position", { ascending: true });

    if (error) throw error;
    return data;
  });
}

export interface PlayerFilters {
  gender: Gender;
  search?: string;
  ageClass?: AgeClass;
  minAge?: number;
  maxAge?: number;
  hideDeleted?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedPlayers {
  players: import("@/lib/types").Player[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getFilteredPlayers(filters: PlayerFilters): Promise<PaginatedPlayers> {
  return withClubContext(async (supabase, clubId) => {
    const {
      gender,
      search,
      ageClass = "all",
      minAge,
      maxAge,
      hideDeleted = false,
      page = 1,
      pageSize = 50,
    } = filters;

    let query = supabase
      .from("players")
      .select("*")
      .eq("gender", gender)
      .eq("club_id", clubId)
      .order("skill_level", { ascending: true })
      .order("sort_position", { ascending: true });

    if (hideDeleted) {
      query = query.is("deleted_at", null);
    }

    if (ageClass !== "all") {
      const ageClassMin = parseInt(ageClass, 10);
      const cutoffYear = new Date().getFullYear() - ageClassMin;
      query = query.lte("birth_date", `${cutoffYear}-12-31`);
    }

    if (minAge) {
      const cutoffYear = new Date().getFullYear() - minAge;
      query = query.lte("birth_date", `${cutoffYear}-12-31`);
    }

    if (maxAge) {
      const minYear = new Date().getFullYear() - maxAge;
      query = query.gte("birth_date", `${minYear}-01-01`);
    }

    if (search && search.trim()) {
      const q = search.trim();
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const allPlayers = data ?? [];

    const { sortPlayers } = await import("@/lib/players");
    const sorted = sortPlayers(allPlayers);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const paginated = sorted.slice(start, start + pageSize);

    return {
      players: paginated,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  });
}

export async function createPlayer(formData: FormData) {
  const profile = await requireRole();
  if (!canAccessGender(profile, formData.get("gender") as Gender)) {
    throw new Error("Keine Berechtigung für dieses Geschlecht");
  }

  return withClubContext(async (supabase, clubId) => {
    const gender = formData.get("gender") as Gender;

    const { data: existing } = await supabase
      .from("players")
      .select("sort_position")
      .eq("gender", gender)
      .eq("club_id", clubId)
      .order("sort_position", { ascending: false })
      .limit(1);

    const maxPos = existing?.[0]?.sort_position ?? 0;

    const firstName = formData.get("first_name") as string;
    const lastName = formData.get("last_name") as string;

    const playerData = {
      license: (formData.get("license") as string) || null,
      last_name: lastName,
      first_name: firstName,
      birth_date: formData.get("birth_date") as string,
      skill_level: formData.get("skill_level") ? parseFloat(formData.get("skill_level") as string) : null,
      gender,
      sort_position: maxPos + 100,
      notes: (formData.get("notes") as string) || null,
      club_id: clubId,
    };

    const { data: inserted, error } = await supabase
      .from("players")
      .insert(playerData)
      .select("uuid")
      .single();

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("event_log").insert({
      event_type: "create",
      gender,
      player_uuid: inserted.uuid,
      details: { after: playerData },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/", "layout");
  });
}

export async function updatePlayer(formData: FormData) {
  const profile = await requireRole();
  if (!canAccessGender(profile, formData.get("gender") as Gender)) {
    throw new Error("Keine Berechtigung für dieses Geschlecht");
  }

  return withClubContext(async (supabase, clubId) => {
    const uuid = formData.get("uuid") as string;
    const gender = formData.get("gender") as Gender;

    const { data: before } = await supabase
      .from("players")
      .select("license, last_name, first_name, birth_date, skill_level, notes")
      .eq("uuid", uuid)
      .eq("club_id", clubId)
      .single();

    const updateData = {
      license: (formData.get("license") as string) || null,
      last_name: formData.get("last_name") as string,
      first_name: formData.get("first_name") as string,
      birth_date: formData.get("birth_date") as string,
      skill_level: formData.get("skill_level") ? parseFloat(formData.get("skill_level") as string) : null,
      gender,
      notes: (formData.get("notes") as string) || null,
    };

    const { error } = await supabase
      .from("players")
      .update(updateData)
      .eq("uuid", uuid)
      .eq("club_id", clubId);

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("event_log").insert({
      event_type: "update",
      gender,
      player_uuid: uuid,
      details: { before, after: updateData },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/", "layout");
  });
}

export async function softDeletePlayer(uuid: string, gender: Gender) {
  const profile = await requireRole();
  if (!canAccessGender(profile, gender)) {
    throw new Error("Keine Berechtigung für dieses Geschlecht");
  }

  return withClubContext(async (supabase, clubId) => {
    const { data: before } = await supabase
      .from("players")
      .select("license, last_name, first_name, birth_date, skill_level, notes, sort_position")
      .eq("uuid", uuid)
      .single();

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("event_log").insert({
      event_type: "delete",
      gender,
      player_uuid: uuid,
      details: { before },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    const { error } = await supabase
      .from("players")
      .update({ deleted_at: new Date().toISOString() })
      .eq("uuid", uuid);

    if (error) throw error;

    await supabase
      .from("player_registrations")
      .delete()
      .eq("player_uuid", uuid);

    revalidatePath("/", "layout");
  });
}

export async function restorePlayer(uuid: string, gender: Gender) {
  const profile = await requireRole();
  if (profile.role !== "admin") {
    throw new Error("Nur Admins können Spieler wiederherstellen");
  }

  return withClubContext(async (supabase, clubId) => {
    const { error } = await supabase
      .from("players")
      .update({ deleted_at: null })
      .eq("uuid", uuid);

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("event_log").insert({
      event_type: "restore",
      gender,
      player_uuid: uuid,
      details: {},
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/", "layout");
  });
}

export async function reorderPlayer(
  uuid: string,
  gender: Gender,
  newSortPosition: number
) {
  const profile = await requireRole();
  if (!canAccessGender(profile, gender)) {
    throw new Error("Keine Berechtigung für dieses Geschlecht");
  }

  return withClubContext(async (supabase, clubId) => {
    const { data: before } = await supabase
      .from("players")
      .select("sort_position")
      .eq("uuid", uuid)
      .single();

    const { error } = await supabase
      .from("players")
      .update({ sort_position: newSortPosition })
      .eq("uuid", uuid);

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("event_log").insert({
      event_type: "reorder",
      gender,
      player_uuid: uuid,
      details: { before: { sort_position: before?.sort_position }, after: { sort_position: newSortPosition } },
      user_id: user?.id ?? null,
      club_id: clubId,
    });
  });
}

export async function rebalancePositions(gender: Gender) {
  const profile = await requireRole();
  if (!canAccessGender(profile, gender)) {
    throw new Error("Keine Berechtigung für dieses Geschlecht");
  }

  return withClubContext(async (supabase, clubId) => {
    const { data: players, error: fetchError } = await supabase
      .from("players")
      .select("uuid, sort_position")
      .eq("gender", gender)
      .eq("club_id", clubId)
      .order("sort_position", { ascending: true });

    if (fetchError) throw fetchError;
    if (!players) return;

    const updates = players.map((p, i) =>
      supabase
        .from("players")
        .update({ sort_position: (i + 1) * 100 })
        .eq("uuid", p.uuid)
    );

    await Promise.all(updates);
  });
}

export async function getRegistrations(gender: Gender, ageClass: AgeClass) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("player_registrations")
      .select("player_uuid, players!inner(club_id)")
      .eq("gender", gender)
      .eq("age_class", ageClass)
      .eq("players.club_id", clubId);

    if (error) throw error;
    return (data ?? []).map((r: { player_uuid: string }) => r.player_uuid);
  });
}

export async function toggleRegistration(
  playerUuid: string,
  ageClass: AgeClass,
  gender: Gender,
  registered: boolean,
  playerName: string
) {
  const profile = await requireRole();
  if (profile.role === "captain") {
    const hasScope = profile.teams?.some((t) => t.gender === gender && t.age_class === ageClass);
    if (!hasScope) {
      throw new Error("Keine Berechtigung für diese Altersklasse");
    }
  }

  return withClubContext(async (supabase, clubId) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (registered) {
      const { error } = await supabase.from("player_registrations").insert({
        player_uuid: playerUuid,
        age_class: ageClass,
        gender,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("player_registrations")
        .delete()
        .eq("player_uuid", playerUuid)
        .eq("age_class", ageClass)
        .eq("gender", gender);
      if (error) throw error;
    }

    await supabase.from("event_log").insert({
      event_type: registered ? "register" : "unregister",
      gender,
      age_class: ageClass,
      player_uuid: playerUuid,
      details: { player_name: playerName },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/", "layout");
  });
}

export interface RadarDataPoint {
  category: string;
  value: number;
}

export interface PlayerDistributions {
  lk: RadarDataPoint[];
  age: RadarDataPoint[];
  totalLk: number;
  totalAge: number;
}

export async function getPlayerDistributions(filters: {
  gender: Gender;
  ageClass: AgeClass;
  minAge?: number;
  maxAge?: number;
  hideDeleted?: boolean;
}): Promise<PlayerDistributions> {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { gender, ageClass, minAge, maxAge, hideDeleted = true } = filters;
    let query = supabase
      .from("players")
      .select("skill_level, birth_date")
      .eq("gender", gender)
      .eq("club_id", clubId);

    if (hideDeleted) {
      query = query.is("deleted_at", null);
    }

    if (ageClass !== "all") {
      const ageClassMin = parseInt(ageClass, 10);
      const cutoffYear = new Date().getFullYear() - ageClassMin;
      query = query.lte("birth_date", `${cutoffYear}-12-31`);
    }

    if (minAge) {
      const cutoffYear = new Date().getFullYear() - minAge;
      query = query.lte("birth_date", `${cutoffYear}-12-31`);
    }

    if (maxAge) {
      const minYear = new Date().getFullYear() - maxAge;
      query = query.gte("birth_date", `${minYear}-01-01`);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data) return { lk: [], age: [], totalLk: 0, totalAge: 0 };

    const currentYear = new Date().getFullYear();

    const lkBuckets: Record<string, number> = {
      "Spitze (1-4)": 0,
      "Stark (5-8)": 0,
      "Mittel (9-13)": 0,
      "Club (14-18)": 0,
      "Freizeit (19-25)": 0,
    };
    let totalLk = 0;
    for (const p of data) {
      if (p.skill_level == null) continue;
      const lk = Math.round(p.skill_level);
      totalLk++;
      if (lk <= 4) lkBuckets["Spitze (1-4)"]++;
      else if (lk <= 8) lkBuckets["Stark (5-8)"]++;
      else if (lk <= 13) lkBuckets["Mittel (9-13)"]++;
      else if (lk <= 18) lkBuckets["Club (14-18)"]++;
      else lkBuckets["Freizeit (19-25)"]++;
    }

    const ageBuckets: Record<string, number> = {
      "< 14": 0,
      "14–18": 0,
      "19–29": 0,
      "30–39": 0,
      "40–49": 0,
      "50–59": 0,
      "60+": 0,
    };
    for (const p of data) {
      const age = currentYear - new Date(p.birth_date).getFullYear();
      if (age < 14) ageBuckets["< 14"]++;
      else if (age <= 18) ageBuckets["14–18"]++;
      else if (age < 30) ageBuckets["19–29"]++;
      else if (age < 40) ageBuckets["30–39"]++;
      else if (age < 50) ageBuckets["40–49"]++;
      else if (age < 60) ageBuckets["50–59"]++;
      else ageBuckets["60+"]++;
    }

    return {
      lk: Object.entries(lkBuckets).map(([category, value]) => ({ category, value })),
      age: Object.entries(ageBuckets).map(([category, value]) => ({ category, value })),
      totalLk,
      totalAge: data.length,
    };
  });
}

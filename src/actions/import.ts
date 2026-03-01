"use server";

import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Gender } from "@/lib/types";
import { withClubContext } from "@/lib/club";

interface ImportPlayer {
  first_name: string;
  last_name: string;
  birth_date: string;
  skill_level: number;
  gender: Gender;
  license?: string | null;
  notes?: string | null;
}

export async function importPlayers(players: ImportPlayer[]) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Get max sort_position per gender (scoped to club)
    const genders = [...new Set(players.map((p) => p.gender))];
    const maxPositions: Record<string, number> = {};

    for (const gender of genders) {
      const { data } = await supabase
        .from("players")
        .select("sort_position")
        .eq("gender", gender)
        .eq("club_id", clubId)
        .order("sort_position", { ascending: false })
        .limit(1);
      maxPositions[gender] = (data?.[0]?.sort_position ?? -100) + 100;
    }

    const skipped: { row: number; name: string; reason: string }[] = [];
    const valid: ImportPlayer[] = [];

    // Fetch existing players for duplicate checking (scoped to club)
    const { data: allExisting } = await supabase
      .from("players")
      .select("first_name, last_name, birth_date")
      .eq("club_id", clubId);

    const existingSet = new Set(
      (allExisting ?? []).map(
        (e) => `${e.first_name.toLowerCase()}|${e.last_name.toLowerCase()}|${e.birth_date}`
      )
    );

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || `Zeile ${i + 1}`;
      if (!p.first_name) { skipped.push({ row: i + 1, name, reason: "Vorname fehlt" }); continue; }
      if (!p.last_name) { skipped.push({ row: i + 1, name, reason: "Nachname fehlt" }); continue; }
      if (!p.birth_date) { skipped.push({ row: i + 1, name, reason: "Geburtsdatum fehlt" }); continue; }

      let birthDate = p.birth_date;
      const dotMatch = birthDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        birthDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
      }

      const key = `${p.first_name.toLowerCase()}|${p.last_name.toLowerCase()}|${birthDate}`;
      if (existingSet.has(key)) {
        skipped.push({ row: i + 1, name, reason: "Spieler existiert bereits" });
        continue;
      }

      existingSet.add(key);
      valid.push(p);
    }

    const rows = valid.map((p) => {
      const pos = maxPositions[p.gender]++;
      let birthDate = p.birth_date;
      const dotMatch = birthDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        birthDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
      }
      return {
        first_name: p.first_name,
        last_name: p.last_name,
        birth_date: birthDate,
        skill_level: (isNaN(p.skill_level) || p.skill_level < 1 || p.skill_level > 25) ? null : p.skill_level,
        gender: p.gender,
        license: p.license || null,
        notes: p.notes || null,
        sort_position: pos,
        club_id: clubId,
      };
    });

    if (rows.length === 0) {
      return { count: 0, total: players.length, skipped };
    }

    const { error } = await supabase.from("players").insert(rows);
    if (error) {
      console.error("Import DB error:", error);
      throw new Error("Datenbankfehler beim Import. Bitte Daten prüfen.");
    }

    await supabase.from("event_log").insert({
      event_type: "csv_import",
      gender: genders[0],
      details: { count: rows.length, genders },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    for (const gender of genders) {
      revalidatePath(`/${gender}`);
    }

    return { count: rows.length, total: players.length, skipped };
  });
}

interface MatchPlayer {
  first_name: string;
  last_name: string;
  birth_date: string;
}

export async function markPlayersForDeletion(players: MatchPlayer[]) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { data: { user } } = await supabase.auth.getUser();

    const deleted: { row: number; name: string; uuid: string; gender: string }[] = [];
    const notFound: { row: number; name: string }[] = [];
    const alreadyDeleted: { row: number; name: string }[] = [];
    const skipped: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || `Zeile ${i + 1}`;

      if (!p.first_name || !p.last_name) {
        skipped.push({ row: i + 1, name, reason: "Name fehlt" });
        continue;
      }

      if (!p.birth_date) {
        skipped.push({ row: i + 1, name, reason: "Geburtsdatum fehlt (wird für eindeutige Zuordnung benötigt)" });
        continue;
      }

      let birthDate = p.birth_date;
      const dotMatch = birthDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        birthDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
      }

      const { data: matches } = await supabase
        .from("players")
        .select("uuid, first_name, last_name, birth_date, gender, deleted_at")
        .eq("club_id", clubId)
        .ilike("first_name", p.first_name.trim())
        .ilike("last_name", p.last_name.trim())
        .eq("birth_date", birthDate);

      if (!matches || matches.length === 0) {
        notFound.push({ row: i + 1, name });
        continue;
      }

      const active = matches.filter((m) => !m.deleted_at);

      if (active.length === 0) {
        alreadyDeleted.push({ row: i + 1, name });
        continue;
      }

      if (active.length > 1) {
        skipped.push({ row: i + 1, name, reason: `${active.length} Treffer gefunden — nicht eindeutig` });
        continue;
      }

      const match = active[0];

      const { error } = await supabase
        .from("players")
        .update({ deleted_at: new Date().toISOString() })
        .eq("uuid", match.uuid);

      if (error) {
        skipped.push({ row: i + 1, name, reason: "Datenbankfehler" });
        continue;
      }

      await supabase
        .from("player_registrations")
        .delete()
        .eq("player_uuid", match.uuid);

      deleted.push({ row: i + 1, name, uuid: match.uuid, gender: match.gender });
    }

    await supabase.from("event_log").insert({
      event_type: "csv_bulk_delete",
      gender: "male",
      details: {
        deleted_count: deleted.length,
        not_found_count: notFound.length,
        already_deleted_count: alreadyDeleted.length,
        skipped_count: skipped.length,
      },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/male");
    revalidatePath("/female");

    return { deleted, notFound, alreadyDeleted, skipped, total: players.length };
  });
}

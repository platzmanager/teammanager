"use server";

import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Gender, Match } from "@/lib/types";
import { withClubContext } from "@/lib/club";
import { createMatchOccurrences } from "@/actions/events";

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
      console.error("Import DB error:", JSON.stringify(error, null, 2));
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
      revalidatePath("/", "layout");
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

    revalidatePath("/", "layout");

    return { deleted, notFound, alreadyDeleted, skipped, total: players.length };
  });
}

// ─── LK Import ───

interface LkRow {
  last_name: string;
  first_name: string;
  license: string;
  birth_date: string;
  skill_level: number;
}

export async function importSkillLevels(rows: LkRow[]) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { data: { user } } = await supabase.auth.getUser();

    let updated = 0;
    let alreadyUpToDate = 0;
    const notFound: { name: string; license: string }[] = [];
    const backfilledList: { name: string; license: string }[] = [];

    // Fetch all players for this club
    const { data: allPlayers, error: playersError } = await supabase
      .from("players")
      .select("uuid, first_name, last_name, birth_date, license, skill_level")
      .eq("club_id", clubId)
      .is("deleted_at", null);

    if (playersError) {
      throw new Error(`Fehler beim Laden der Spieler: ${playersError.message}`);
    }

    const players = allPlayers ?? [];

    // Build lookup maps
    const byLicense = new Map<string, typeof players[0]>();
    const byNameDob = new Map<string, typeof players[0]>();
    for (const p of players) {
      if (p.license) byLicense.set(p.license, p);
      const key = `${p.first_name.toLowerCase()}|${p.last_name.toLowerCase()}|${p.birth_date}`;
      byNameDob.set(key, p);
    }

    for (const row of rows) {
      const name = `${row.first_name} ${row.last_name}`;
      const lk = isNaN(row.skill_level) ? null : row.skill_level;

      // Try match by license first
      let player = row.license ? byLicense.get(row.license) : undefined;
      let needsBackfill = false;

      if (!player) {
        // Fallback: match by name + birth_date
        let birthDate = row.birth_date;
        const dotMatch = birthDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (dotMatch) {
          birthDate = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
        }
        const key = `${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}|${birthDate}`;
        player = byNameDob.get(key);
        if (player) needsBackfill = true;
      }

      if (!player) {
        notFound.push({ name, license: row.license });
        continue;
      }

      if (lk !== null && player.skill_level === lk && !needsBackfill) {
        alreadyUpToDate++;
        continue;
      }

      const updateData: Record<string, unknown> = {};
      if (lk !== null) updateData.skill_level = lk;
      if (needsBackfill && row.license) updateData.license = row.license;

      if (Object.keys(updateData).length === 0) {
        alreadyUpToDate++;
        continue;
      }

      const { error: updateError } = await supabase.from("players").update(updateData).eq("uuid", player.uuid);
      if (updateError) {
        throw new Error(`Fehler beim Aktualisieren von ${name}: ${updateError.message}`);
      }
      updated++;
      if (needsBackfill && row.license) backfilledList.push({ name, license: row.license });
    }

    await supabase.from("event_log").insert({
      event_type: "lk_import",
      gender: "male",
      details: { updated, backfilled: backfilledList.length, alreadyUpToDate, notFound: notFound.length, total: rows.length },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    revalidatePath("/", "layout");

    return { updated, backfilled: backfilledList.length, backfilledList, alreadyUpToDate, notFound, total: rows.length };
  });
}

// ─── Schedule Import ───

interface ScheduleRow {
  match_date: string;
  match_time: string;
  home_team: string;
  away_team: string;
  match_number: string;
  location: string;
  gender: Gender;
  age_class: string;
  league_class: string;
  league: string;
  league_group: string;
}

export async function importSchedule(
  rows: ScheduleRow[],
  teamMapping: Record<string, string>, // "gender|age_class" → team_id
  ownTeamNames: Record<string, string> // "gender|age_class" → CSV team name
) {
  await requireAdmin();

  return withClubContext(async (supabase, clubId) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch teams for this club
    const { data: allTeams, error: teamsError } = await supabase
      .from("teams")
      .select("id, gender, age_class, league_class, league, league_group")
      .eq("club_id", clubId);
    if (teamsError) {
      throw new Error(`Fehler beim Laden der Mannschaften: ${teamsError.message}`);
    }
    const teams = allTeams ?? [];

    // Build resolved mapping: gender|age_class → team_id
    const resolvedMapping: Record<string, string> = { ...teamMapping };
    // Auto-resolve unambiguous teams
    const grouped = new Map<string, typeof teams>();
    for (const t of teams) {
      const key = `${t.gender}|${t.age_class}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }
    for (const [key, candidates] of grouped) {
      if (candidates.length === 1 && !resolvedMapping[key]) {
        resolvedMapping[key] = candidates[0].id;
      }
    }

    const skipped: { reason: string }[] = [];
    const matchInserts: Record<string, unknown>[] = [];
    const teamEnrichments: Record<string, { league_class: string; league: string; league_group: string }> = {};
    const teamsToDelete = new Set<string>();

    for (const row of rows) {
      const key = `${row.gender}|${row.age_class}`;
      const teamId = resolvedMapping[key];

      if (!teamId) {
        skipped.push({ reason: `Keine Mannschaft für ${row.gender === "female" ? "Damen" : "Herren"} ${row.age_class}: ${row.home_team} vs ${row.away_team}` });
        continue;
      }

      const ownName = ownTeamNames[key];
      const isHome = ownName ? row.home_team === ownName : false;

      matchInserts.push({
        team_id: teamId,
        club_id: clubId,
        match_date: row.match_date,
        match_time: row.match_time || null,
        is_home: isHome,
        home_team: row.home_team,
        away_team: row.away_team,
        match_number: row.match_number || null,
        location: row.location || null,
      });

      teamsToDelete.add(teamId);

      // Collect enrichment data (first occurrence wins)
      if (!teamEnrichments[teamId] && (row.league_class || row.league || row.league_group)) {
        teamEnrichments[teamId] = {
          league_class: row.league_class,
          league: row.league,
          league_group: row.league_group,
        };
      }
    }

    // Delete existing matches for affected teams (full replace)
    for (const teamId of teamsToDelete) {
      const { error: deleteError } = await supabase.from("matches").delete().eq("team_id", teamId).eq("club_id", clubId);
      if (deleteError) {
        throw new Error("Datenbankfehler beim Löschen bestehender Spiele.");
      }
    }

    // Insert matches in batches
    let imported = 0;
    const batchSize = 100;
    for (let i = 0; i < matchInserts.length; i += batchSize) {
      const batch = matchInserts.slice(i, i + batchSize);
      const { error } = await supabase.from("matches").insert(batch);
      if (error) {
        console.error("Schedule import error:", JSON.stringify(error, null, 2));
        throw new Error("Datenbankfehler beim Import der Spiele.");
      }
      imported += batch.length;
    }

    // Enrich teams with league info
    let teamsEnriched = 0;
    for (const [teamId, enrichment] of Object.entries(teamEnrichments)) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;

      const needsUpdate =
        team.league_class !== enrichment.league_class ||
        team.league !== enrichment.league ||
        team.league_group !== enrichment.league_group;

      if (needsUpdate) {
        const { error: enrichError } = await supabase.from("teams").update(enrichment).eq("id", teamId);
        if (enrichError) {
          throw new Error("Datenbankfehler beim Aktualisieren der Mannschaften.");
        }
        teamsEnriched++;
      }
    }

    await supabase.from("event_log").insert({
      event_type: "schedule_import",
      gender: "male",
      details: { imported, teamsEnriched, skipped: skipped.length },
      user_id: user?.id ?? null,
      club_id: clubId,
    });

    // Create event occurrences for imported matches
    for (const teamId of teamsToDelete) {
      const { data: teamMatches } = await supabase
        .from("matches")
        .select("*")
        .eq("team_id", teamId)
        .eq("club_id", clubId)
        .order("match_date");
      if (teamMatches && teamMatches.length > 0) {
        await createMatchOccurrences(teamId, teamMatches as Match[]);
      }
    }

    revalidatePath("/", "layout");

    return { imported, teamsEnriched, skipped };
  });
}

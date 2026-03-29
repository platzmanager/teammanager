"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { withClubContext } from "@/lib/club";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { MatchLineup } from "@/lib/types";

export async function getLineup(matchId: string): Promise<MatchLineup[]> {
  return withClubContext(async (supabase) => {
    const { data, error } = await supabase
      .from("match_lineups")
      .select("*, player:players(*)")
      .eq("match_id", matchId);

    if (error) throw error;
    return (data ?? []) as MatchLineup[];
  });
}

export async function updateLineup(matchId: string, playerUuids: string[]) {
  const profile = await requireRole();
  const user = await getUser();
  if (!user) throw new Error("Nicht angemeldet");

  return withClubContext(async (supabase, clubId) => {
    // Fetch match to verify team ownership
    const { data: match } = await supabase
      .from("matches")
      .select("team_id")
      .eq("id", matchId)
      .eq("club_id", clubId)
      .single();

    if (!match) throw new Error("Match nicht gefunden");

    if (profile.role !== "admin") {
      if (!profile.captainTeamIds.includes(match.team_id)) {
        throw new Error("Keine Berechtigung");
      }
    }

    // Atomic replace via RPC — delete + insert in a single transaction
    const admin = createAdminClient();
    const { error } = await admin.rpc("replace_match_lineup", {
      p_match_id: matchId,
      p_player_uuids: playerUuids,
      p_created_by: user.id,
    });

    if (error) throw error;

    revalidatePath("/", "layout");
  });
}

export async function getSeasonMatchCounts(
  teamId: string
): Promise<Record<string, number>> {
  await requireRole();

  return withClubContext(async () => {
    const seasonStart = `${new Date().getFullYear()}-01-01`;

    // Use admin client for the cross-table join query
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("match_lineups")
      .select("player_uuid, matches!inner(team_id, match_date)")
      .eq("matches.team_id", teamId)
      .gte("matches.match_date", seasonStart);

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.player_uuid] = (counts[row.player_uuid] ?? 0) + 1;
    }
    return counts;
  });
}

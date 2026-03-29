import { redirect, notFound } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { getOccurrence } from "@/actions/events";
import { getMyResponses } from "@/actions/rsvp";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortPlayers } from "@/lib/players";
import { EventDetailClient, type TeamMemberWithSort } from "./event-detail-client";

async function getTeamRoster(teamId: string): Promise<TeamMemberWithSort[]> {
  const admin = createAdminClient();

  const { data: assignments, error } = await admin
    .from("member_team_assignments")
    .select("member_id, members!inner(id, first_name, last_name, player_uuid)")
    .eq("team_id", teamId);

  if (error || !assignments) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = assignments.map((a: any) => a.members as {
    id: string;
    first_name: string;
    last_name: string;
    player_uuid: string | null;
  });

  // Fetch sort info for members that have a player_uuid
  const playerUuids = members.map((m) => m.player_uuid).filter(Boolean) as string[];
  const playerSortMap = new Map<string, { skill_level: number | null; sort_position: number }>();

  if (playerUuids.length > 0) {
    const { data: players } = await admin
      .from("players")
      .select("uuid, skill_level, sort_position")
      .in("uuid", playerUuids);

    if (players) {
      // Use sortPlayers to get the correct order, then map to index
      const sorted = sortPlayers(players.map((p) => ({
        ...p,
        club_id: "",
        license: null,
        last_name: "",
        first_name: "",
        birth_date: "",
        gender: "male" as const,
        notes: null,
        created_at: "",
        deleted_at: null,
      })));
      for (let i = 0; i < sorted.length; i++) {
        playerSortMap.set(sorted[i].uuid, {
          skill_level: sorted[i].skill_level,
          sort_position: i,
        });
      }
    }
  }

  return members.map((m) => {
    const sort = m.player_uuid ? playerSortMap.get(m.player_uuid) : undefined;
    return {
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      player_uuid: m.player_uuid,
      sortIndex: sort?.sort_position ?? 9999,
    };
  }).sort((a, b) => a.sortIndex - b.sortIndex);
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ clubSlug: string; occurrenceId: string }>;
}) {
  const { occurrenceId } = await params;
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  let occurrence;
  try {
    occurrence = await getOccurrence(occurrenceId);
  } catch {
    notFound();
  }
  if (!occurrence) notFound();

  const myResponses = await getMyResponses([occurrenceId]);

  // Load team roster for sorting and non-responder display
  const teamId = occurrence.event?.team_id;
  const teamMembers = teamId ? await getTeamRoster(teamId) : [];

  return (
    <EventDetailClient
      occurrence={occurrence}
      myResponse={myResponses[occurrenceId] ?? null}
      teamMembers={teamMembers}
    />
  );
}

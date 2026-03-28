import { redirect } from "next/navigation";
import { getUserProfile, getMemberTeamIds } from "@/lib/auth";
import { getMemberEvents } from "@/actions/events";
import { getMyResponses } from "@/actions/rsvp";
import { EventsClient } from "./events-client";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  // Combine teams from user_team_assignments (admin/captain) and member_team_assignments (player)
  const userTeamIds = (profile.teams ?? []).map((t) => t.id);
  const memberTeamIds = await getMemberTeamIds();
  const teamIds = [...new Set([...userTeamIds, ...memberTeamIds])];
  const occurrences = await getMemberEvents(teamIds);
  const occurrenceIds = occurrences.map((o) => o.id);
  const myResponses = await getMyResponses(occurrenceIds);

  const isAdminOrCaptain = profile.role === "admin" || profile.role === "captain";

  return (
    <EventsClient
      occurrences={occurrences}
      myResponses={myResponses}
      isAdminOrCaptain={isAdminOrCaptain}
      clubSlug={clubSlug}
      teamIds={teamIds}
    />
  );
}

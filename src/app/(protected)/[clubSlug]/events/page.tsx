import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
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

  const teamIds = (profile.teams ?? []).map((t) => t.id);
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

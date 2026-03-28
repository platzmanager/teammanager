import { redirect, notFound } from "next/navigation";
import { getUserProfile, getMemberForUser } from "@/lib/auth";
import { getOccurrence } from "@/actions/events";
import { getMyResponses } from "@/actions/rsvp";
import { EventDetailClient } from "./event-detail-client";

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

  return (
    <EventDetailClient
      occurrence={occurrence}
      myResponse={myResponses[occurrenceId] ?? null}
    />
  );
}

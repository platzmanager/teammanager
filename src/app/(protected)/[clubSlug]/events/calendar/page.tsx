import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth";
import { getMemberEvents } from "@/actions/events";
import { getMyResponses } from "@/actions/rsvp";
import { CalendarView } from "@/components/calendar-view";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function CalendarPage({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${clubSlug}/events`}
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 -ml-1 h-5 w-5 shrink-0" />
          Termine
        </Link>
        <h2 className="text-2xl font-bold">Kalender</h2>
      </div>
      <CalendarView occurrences={occurrences} myResponses={myResponses} />
    </div>
  );
}

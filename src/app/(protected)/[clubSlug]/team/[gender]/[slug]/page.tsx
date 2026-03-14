import { redirect, notFound } from "next/navigation";
import { Gender } from "@/lib/types";
import { getUserProfile, canAccessGender, getDefaultPath } from "@/lib/auth";
import { getTeamBySlug, getTeamCaptains, getRegisteredPlayers, getBlockedCount, getTeamMatches } from "@/actions/teams";
import { getTeamEvents } from "@/actions/events";
import { getMyResponses } from "@/actions/rsvp";
import { TeamDetailClient } from "./team-detail-client";

const validGenders: Gender[] = ["female", "male"];

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ clubSlug: string; gender: string; slug: string }>;
}) {
  const { clubSlug, gender, slug } = await params;
  const profile = await getUserProfile();

  if (!profile) redirect("/login");

  if (!validGenders.includes(gender as Gender) || !canAccessGender(profile, gender as Gender)) {
    redirect(getDefaultPath(profile, clubSlug));
  }

  const team = await getTeamBySlug(gender as Gender, slug);
  if (!team) notFound();

  const [captains, players, blockedCount, matches, eventOccurrences] = await Promise.all([
    getTeamCaptains(team.id),
    getRegisteredPlayers(team.gender, team.age_class),
    getBlockedCount(team),
    getTeamMatches(team.id),
    getTeamEvents(team.id),
  ]);

  const occurrenceIds = eventOccurrences.map((o) => o.id);
  const myResponses = await getMyResponses(occurrenceIds);

  const isAdmin = profile.role === "admin";
  const isCaptain = profile.teams?.some((t) => t.id === team.id) ?? false;

  return (
    <TeamDetailClient
      team={team}
      captains={captains}
      players={players}
      blockedCount={blockedCount}
      matches={matches}
      eventOccurrences={eventOccurrences}
      myResponses={myResponses}
      isAdmin={isAdmin}
      isCaptain={isCaptain}
      clubSlug={clubSlug}
    />
  );
}

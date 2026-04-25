import { redirect, notFound } from "next/navigation";
import { Gender } from "@/lib/types";
import { getUserProfile, canAccessGender, getDefaultPath } from "@/lib/auth";
import { getTeamBySlug, getTeamCaptains, getRegisteredPlayers, getBlockedCount, getTeamMatches } from "@/actions/teams";
import { getTeamEvents } from "@/actions/events";
import { getMyResponses } from "@/actions/rsvp";
import { getMealSettings } from "@/actions/meals";
import { withClubContext } from "@/lib/club";
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

  const isAdmin = profile.role === "admin";
  const isCaptain = profile.captainTeamIds?.includes(team.id) ?? false;

  const [captains, players, blockedCount, matches, eventOccurrences, mealSettings] = await Promise.all([
    getTeamCaptains(team.id),
    getRegisteredPlayers(team.gender, team.age_class),
    getBlockedCount(team),
    getTeamMatches(team.id),
    getTeamEvents(team.id),
    getMealSettings(),
  ]);

  // Load home matches with their meal claims for captain/admin
  const homeMatches = (isAdmin || isCaptain)
    ? await withClubContext(async (supabase, clubId) => {
        const { data } = await supabase
          .from("matches")
          .select("id, match_date, match_time, home_team, away_team, location, meal_claims(*)")
          .eq("club_id", clubId)
          .eq("team_id", team.id)
          .eq("is_home", true)
          .order("match_date", { ascending: true });
        return data ?? [];
      })
    : [];

  const occurrenceIds = eventOccurrences.map((o) => o.id);
  const myResponses = await getMyResponses(occurrenceIds);

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
      homeMatches={homeMatches as any}
      amountPerMeal={mealSettings?.amount_per_meal ?? 10}
    />
  );
}

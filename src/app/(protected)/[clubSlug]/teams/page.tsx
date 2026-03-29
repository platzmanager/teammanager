import { redirect } from "next/navigation";
import { getNextMatches, getPendingMatchCounts, getTeams } from "@/actions/teams";
import { getUserProfile } from "@/lib/auth";
import { TeamsView } from "./teams-view";

export default async function TeamsPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  const [teams, nextMatches, matchCounts] = await Promise.all([
    getTeams(),
    getNextMatches(),
    getPendingMatchCounts(),
  ]);

  return (
    <TeamsView
      initialTeams={teams}
      initialNextMatches={nextMatches}
      initialMatchCounts={matchCounts}
      profile={profile}
    />
  );
}

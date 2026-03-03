import { redirect, notFound } from "next/navigation";
import { Gender } from "@/lib/types";
import { getUserProfile, canAccessGender, getDefaultPath } from "@/lib/auth";
import { getTeamBySlug, getTeamCaptains, getRegisteredPlayers, getBlockedCount } from "@/actions/teams";
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

  const [captains, players, blockedCount] = await Promise.all([
    getTeamCaptains(team.id),
    getRegisteredPlayers(team.gender, team.age_class),
    getBlockedCount(team),
  ]);
  const isAdmin = profile.role === "admin";

  return (
    <TeamDetailClient
      team={team}
      captains={captains}
      players={players}
      blockedCount={blockedCount}
      isAdmin={isAdmin}
      clubSlug={clubSlug}
    />
  );
}

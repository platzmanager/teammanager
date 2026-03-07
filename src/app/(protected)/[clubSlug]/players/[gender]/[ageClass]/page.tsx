import { redirect } from "next/navigation";
import { Gender, AgeClass } from "@/lib/types";
import { PlayerTable } from "@/components/player-table";
import { getUserProfile, canAccessGender, canAccessTeamScope, getUserAgeClasses, getDefaultPath } from "@/lib/auth";
import { getFilteredPlayers } from "@/actions/players";
import { getTeams } from "@/actions/teams";
import { getCurrentClubId, getLastAgeClass, setLastAgeClass } from "@/lib/club";

const validGenders: Gender[] = ["female", "male"];
const validAgeClasses: AgeClass[] = ["all", "30", "40", "50", "60", "u9", "u10", "u12", "u15", "u18"];

export default async function GenderAgeClassPage({
  params,
}: {
  params: Promise<{ clubSlug: string; gender: string; ageClass: string }>;
}) {
  const { clubSlug, gender, ageClass: ageClassSlug } = await params;
  const profile = await getUserProfile();

  if (!profile) redirect("/login");

  if (!validGenders.includes(gender as Gender) || !canAccessGender(profile, gender as Gender)) {
    redirect(getDefaultPath(profile, clubSlug));
  }

  if (!validAgeClasses.includes(ageClassSlug as AgeClass)) {
    redirect(`/${clubSlug}/players/${gender}/all`);
  }

  const ageClass = ageClassSlug as AgeClass;

  // Captain trying to access an age class they don't have
  if (!canAccessTeamScope(profile, gender as Gender, ageClass)) {
    const allowed = getUserAgeClasses(profile, gender as Gender);
    const last = await getLastAgeClass(gender);
    const target = last && allowed.includes(last as AgeClass) ? last : (allowed[0] ?? "all");
    redirect(`/${clubSlug}/players/${gender}/${target}`);
  }

  // Persist last-viewed age class
  await setLastAgeClass(gender, ageClass);

  const initialData = await getFilteredPlayers({
    gender: gender as Gender,
    ageClass,
    page: 1,
    pageSize: 50,
  });

  const isAdmin = profile.role === "admin";
  const allowedGenders = isAdmin ? validGenders : [gender as Gender];
  const allowedAgeClasses = getUserAgeClasses(profile, gender as Gender);
  const clubId = await getCurrentClubId();
  const teams = await getTeams();
  const userTeamIds = new Set(profile.teams?.map((t) => t.id) ?? []);
  // Prefer the user's own team for the breadcrumb, fall back to first match
  const parentTeam = teams.find((t) => t.gender === gender && t.age_class === ageClass && userTeamIds.has(t.id))
    ?? teams.find((t) => t.gender === gender && t.age_class === ageClass)
    ?? null;

  return (
    <div className="space-y-4">
      <PlayerTable
        allowedGenders={allowedGenders.length > 1 ? allowedGenders : undefined}
        key={`${gender}-${ageClass}`}
        gender={gender as Gender}
        ageClass={ageClass}
        initialData={initialData}
        isAdmin={isAdmin}
        allowedAgeClasses={allowedAgeClasses.length > 1 ? allowedAgeClasses : undefined}
        clubId={clubId ?? undefined}
        clubSlug={clubSlug}
        parentTeam={parentTeam ? { name: parentTeam.name, href: `/${clubSlug}/team/${parentTeam.gender}/${parentTeam.slug}` } : undefined}
      />
    </div>
  );
}

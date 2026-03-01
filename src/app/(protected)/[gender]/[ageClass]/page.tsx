import { redirect } from "next/navigation";
import { Gender, AgeClass } from "@/lib/types";
import { PlayerTable } from "@/components/player-table";
import { getUserProfile, canAccessGender, canAccessTeamScope, getUserAgeClasses, getDefaultPath } from "@/lib/auth";
import { getFilteredPlayers } from "@/actions/players";
import { getCurrentClubId } from "@/lib/club";

const validGenders: Gender[] = ["female", "male"];
const validAgeClasses: AgeClass[] = ["offen", "30", "40", "50", "60"];

function urlToAgeClass(slug: string): AgeClass | null {
  if (slug === "all") return "offen";
  if (validAgeClasses.includes(slug as AgeClass)) return slug as AgeClass;
  return null;
}

export function ageClassToUrl(ac: AgeClass): string {
  return ac === "offen" ? "all" : ac;
}

export default async function GenderAgeClassPage({
  params,
}: {
  params: Promise<{ gender: string; ageClass: string }>;
}) {
  const { gender, ageClass: ageClassSlug } = await params;
  const profile = await getUserProfile();

  if (!profile) redirect("/login");

  if (!validGenders.includes(gender as Gender) || !canAccessGender(profile, gender as Gender)) {
    redirect(getDefaultPath(profile));
  }

  const ageClass = urlToAgeClass(ageClassSlug);
  if (!ageClass) {
    redirect(`/${gender}/all`);
  }

  // Captain trying to access an age class they don't have
  if (!canAccessTeamScope(profile, gender as Gender, ageClass)) {
    const allowed = getUserAgeClasses(profile, gender as Gender);
    redirect(`/${gender}/${ageClassToUrl(allowed[0] ?? "offen")}`);
  }

  const initialData = await getFilteredPlayers({
    gender: gender as Gender,
    ageClass,
    page: 1,
    pageSize: 50,
  });

  const isAdmin = profile.role === "admin";
  const allowedAgeClasses = getUserAgeClasses(profile, gender as Gender);
  const clubId = await getCurrentClubId();

  return (
    <div className="space-y-4">
      <PlayerTable
        key={`${gender}-${ageClass}`}
        gender={gender as Gender}
        ageClass={ageClass}
        initialData={initialData}
        isAdmin={isAdmin}
        allowedAgeClasses={isAdmin ? allowedAgeClasses : undefined}
        clubId={clubId ?? undefined}
      />
    </div>
  );
}

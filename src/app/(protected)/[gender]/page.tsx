import { redirect } from "next/navigation";
import { Gender } from "@/lib/types";
import { PlayerTable } from "@/components/player-table";
import { getUserProfile } from "@/lib/auth";
import { getFilteredPlayers } from "@/actions/players";

const validGenders: Gender[] = ["damen", "herren"];

export default async function GenderPage({
  params,
}: {
  params: Promise<{ gender: string }>;
}) {
  const { gender } = await params;

  if (!validGenders.includes(gender as Gender)) {
    redirect("/damen");
  }

  const initialData = await getFilteredPlayers({
    gender: gender as Gender,
    page: 1,
    pageSize: 50,
  });

  const profile = await getUserProfile();
  const isAdmin = profile?.role === "admin";
  const genderLabel = gender === "damen" ? "Damen" : "Herren";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Meldeliste {genderLabel}</h2>
      <PlayerTable
        gender={gender as Gender}
        initialData={initialData}
        isAdmin={isAdmin}
      />
    </div>
  );
}

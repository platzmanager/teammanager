import { notFound } from "next/navigation";
import { getTeamByInviteToken } from "@/actions/members";
import { JoinForm } from "./join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const team = await getTeamByInviteToken(token);

  if (!team) {
    notFound();
  }

  const club = team.club as { id: string; name: string; slug: string };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Registrieren
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Tritt <span className="font-medium">{team.name}</span> bei{" "}
            <span className="font-medium">{club.name}</span> bei
          </p>
        </div>
        <JoinForm token={token} teamName={team.name} clubName={club.name} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTeamByInviteToken } from "@/actions/members";
import { getUser } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const team = await getTeamByInviteToken(token);

  if (!team) {
    return { title: "Einladung nicht gefunden" };
  }

  const club = team.club as { id: string; name: string; slug: string };
  const title = `${team.name} beitreten | ${club.name}`;
  const description = `Tritt dem Team ${team.name} beim ${club.name} bei. Trage deine Verfügbarkeiten für die kommende Saison ein.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

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

  // Check if user is already logged in
  const user = await getUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {user ? "Team beitreten" : "Registrieren"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Tritt <span className="font-medium">{team.name}</span> bei{" "}
            <span className="font-medium">{club.name}</span> bei
          </p>
        </div>
        <JoinForm
          token={token}
          teamName={team.name}
          clubName={club.name}
          clubSlug={club.slug}
          loggedInEmail={user?.email ?? null}
        />
      </div>
    </div>
  );
}

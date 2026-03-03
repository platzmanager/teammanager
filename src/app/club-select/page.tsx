import { getUserClubs, switchClub } from "@/actions/club";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import logo from "@/assets/logo/matchday-slogan-green.svg";

export default async function ClubSelectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clubs = await getUserClubs();

  if (clubs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <Image src={logo} alt="Matchday.tennis" className="mb-16 h-10 w-auto" priority />
        <div className="text-center">
          <h1 className="text-xl font-bold">Kein Club zugewiesen</h1>
          <p className="mt-2 text-muted-foreground">
            Bitte kontaktiere einen Administrator.
          </p>
        </div>
        <form action="/api/logout" method="POST" className="mt-6">
          <button type="submit" className="mt-8 rounded-lg border px-8 py-3 text-base font-medium text-muted-foreground hover:bg-gray-100 transition-colors">
            Abmelden
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <Image src={logo} alt="Matchday.tennis" className="mb-16 h-10 w-auto" priority />
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">Club auswählen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Für welchen Club möchtest du arbeiten?
          </p>
        </div>
        <div className="space-y-2">
          {clubs.map((club) => (
            <form key={club.id} action={async () => {
              "use server";
              await switchClub(club.id);
            }}>
              <button
                type="submit"
                className="w-full rounded-lg border bg-white px-4 py-3 text-left font-medium hover:bg-gray-50 transition-colors"
              >
                {club.name}
              </button>
            </form>
          ))}
        </div>
        <form action="/api/logout" method="POST" className="text-center">
          <button type="submit" className="mt-8 rounded-lg border px-8 py-3 text-base font-medium text-muted-foreground hover:bg-gray-100 transition-colors">
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );
}

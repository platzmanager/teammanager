import { getUserClubs, switchClub } from "@/actions/club";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClubSelectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clubs = await getUserClubs();

  if (clubs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-xl font-bold">Kein Club zugewiesen</h1>
          <p className="mt-2 text-muted-foreground">
            Bitte kontaktiere einen Administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
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
      </div>
    </div>
  );
}

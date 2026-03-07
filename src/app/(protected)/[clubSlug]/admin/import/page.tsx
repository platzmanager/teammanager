import { requireAdmin } from "@/lib/auth";
import { withClubContext } from "@/lib/club";
import { Team } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerImport } from "@/components/import/player-import";
import { LkImport } from "@/components/import/lk-import";
import { ScheduleImport } from "@/components/import/schedule-import";

export default async function ImportPage() {
  await requireAdmin();

  const teams = await withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("club_id", clubId)
      .order("gender")
      .order("age_class");
    if (error) {
      throw new Error(`Fehler beim Laden der Mannschaften: ${error.message}`);
    }
    return (data ?? []) as Team[];
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Import</h2>
      <Tabs defaultValue="players">
        <TabsList>
          <TabsTrigger value="players">Spieler</TabsTrigger>
          <TabsTrigger value="lk">LK</TabsTrigger>
          <TabsTrigger value="schedule">Spielplan</TabsTrigger>
        </TabsList>
        <TabsContent value="players" className="mt-4">
          <PlayerImport />
        </TabsContent>
        <TabsContent value="lk" className="mt-4">
          <LkImport />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <ScheduleImport teams={teams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

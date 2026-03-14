import { redirect } from "next/navigation";
import { type Gender, type AgeClass, AGE_CLASS_CONFIG, GENDER_LABELS } from "@/lib/types";
import { getUserProfile, canAccessGender, getDefaultPath, getUserAgeClasses, getUserGenders } from "@/lib/auth";
import { getPlayerOverviewData } from "@/actions/players";
import { getTeams } from "@/actions/teams";
import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AgeClassTabs } from "@/components/age-class-tabs";

const validGenders: Gender[] = ["female", "male"];

const AGE_CLASS_ORDER: AgeClass[] = ["u9", "u10", "u12", "u15", "u18", "all", "30", "40", "50", "60"];

export default async function PlayerOverviewPage({
  params,
}: {
  params: Promise<{ clubSlug: string; gender: string }>;
}) {
  const { clubSlug, gender } = await params;
  const profile = await getUserProfile();

  if (!profile) redirect("/login");

  if (!validGenders.includes(gender as Gender) || !canAccessGender(profile, gender as Gender)) {
    redirect(getDefaultPath(profile, clubSlug));
  }

  const [{ players, registrationMap }, teams] = await Promise.all([
    getPlayerOverviewData(gender as Gender),
    getTeams(),
  ]);

  // Determine which age classes have teams for this gender
  const teamAgeClasses = new Set(
    teams
      .filter((t) => t.gender === gender)
      .map((t) => t.age_class),
  );

  const columns = AGE_CLASS_ORDER.filter((ac) => teamAgeClasses.has(ac));

  const genderLabel = GENDER_LABELS[gender as Gender];
  const allowedAgeClasses = getUserAgeClasses(profile, gender as Gender);
  const allowedGenders = getUserGenders(profile);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl/7 font-bold sm:truncate sm:text-3xl sm:tracking-tight">
          Übersicht {genderLabel}
        </h2>
      </div>

      {/* Gender switcher + Age class tabs */}
      <div className="flex items-center gap-2">
        {allowedGenders.length > 1 && (
          <div className="inline-flex items-center rounded-lg bg-muted p-1">
            {allowedGenders.map((g) => (
              <Link
                key={g}
                href={`/${clubSlug}/players/${g}/overview`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  g === gender
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {GENDER_LABELS[g]}
              </Link>
            ))}
          </div>
        )}
        <AgeClassTabs
          gender={gender as Gender}
          current={"overview"}
          allowed={allowedAgeClasses}
          clubSlug={clubSlug}
        />
      </div>

      {/* Matrix table */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">LK</TableHead>
              <TableHead className="text-center">Jg.</TableHead>
              {columns.map((ac) => (
                <TableHead key={ac} className="text-center">
                  {ac === "all" ? "00" : AGE_CLASS_CONFIG[ac].label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4 + columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  Keine Spieler gefunden
                </TableCell>
              </TableRow>
            ) : (
              players.map((player, index) => {
                const playerRegs = new Set(registrationMap[player.uuid] ?? []);
                const birthYear = new Date(player.birth_date).getFullYear();
                return (
                  <TableRow key={player.uuid}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {player.last_name}, {player.first_name}
                    </TableCell>
                    <TableCell className="text-center">
                      {player.skill_level != null ? player.skill_level : "–"}
                    </TableCell>
                    <TableCell className="text-center">{birthYear}</TableCell>
                    {columns.map((ac) => (
                      <TableCell key={ac} className="text-center">
                        {playerRegs.has(ac) && (
                          <Check className="mx-auto h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">{players.length} Spieler</p>
    </div>
  );
}

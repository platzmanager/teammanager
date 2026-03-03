"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Team, Gender, GENDER_LABELS, UserProfile } from "@/lib/types";
import { getTeams, getSessionProfile, getRegistrationCounts } from "@/actions/teams";
import { TeamForm } from "@/components/team-form";

const genderFilters: { value: Gender | "all"; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "female", label: GENDER_LABELS.female },
  { value: "male", label: GENDER_LABELS.male },
];

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all");
  const router = useRouter();
  const params = useParams<{ clubSlug: string }>();

  const isAdmin = profile?.role === "admin";
  const userTeamIds = new Set(profile?.teams?.map((t) => t.id) ?? []);

  const refresh = async () => {
    const [data, counts] = await Promise.all([getTeams(), getRegistrationCounts()]);
    setTeams(data);
    setRegCounts(counts);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTeams(), getSessionProfile(), getRegistrationCounts()]).then(([data, prof, counts]) => {
      if (!cancelled) {
        setTeams(data);
        setProfile(prof);
        setRegCounts(counts);
      }
    }).catch((err) => {
      console.error("Failed to load teams:", err);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = genderFilter === "all" ? teams : teams.filter((t) => t.gender === genderFilter);

  // Total registered players available for this team (registered minus blocked by higher-ranked teams)
  function getTeamAvailableCount(team: Team): number {
    const key = `${team.gender}:${team.age_class}`;
    const totalRegistered = regCounts[key] ?? 0;
    const sameGroup = teams.filter((t) => t.gender === team.gender && t.age_class === team.age_class);
    const blockedCount = sameGroup
      .filter((t) => t.rank < team.rank)
      .reduce((sum, t) => sum + t.team_size, 0);
    return Math.max(0, totalRegistered - blockedCount);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Teams</h2>
        {isAdmin && <TeamForm onDone={refresh} />}
      </div>

      {/* Gender filter */}
      <div className="inline-flex items-center rounded-lg bg-muted p-1">
        {genderFilters.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setGenderFilter(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              genderFilter === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Geschlecht</TableHead>
              <TableHead>Altersklasse</TableHead>
              <TableHead className="text-center">Gemeldet</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Keine Teams vorhanden
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((team) => {
                const canAccess = isAdmin || userTeamIds.has(team.id);
                return (
                  <TableRow
                    key={team.id}
                    className={cn(
                      canAccess ? "cursor-pointer hover:bg-muted/50" : "text-muted-foreground"
                    )}
                    onClick={canAccess ? () => router.push(`/${params.clubSlug}/team/${team.gender}/${team.slug}`) : undefined}
                  >
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{GENDER_LABELS[team.gender]}</TableCell>
                    <TableCell>{team.age_class === "all" ? "Alle" : team.age_class}</TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const available = getTeamAvailableCount(team);
                        return (
                          <span className={cn(available < team.team_size ? "text-amber-600" : "text-green-600")}>
                            {available}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{canAccess && <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

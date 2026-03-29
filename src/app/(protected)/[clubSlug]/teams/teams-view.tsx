"use client";

import { Calendar, ChevronRight, Globe, Home, Lock } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getNextMatches, getPendingMatchCounts, getTeams } from "@/actions/teams";
import { TeamForm } from "@/components/team-form";
import type { Gender, Match, Team, UserProfile } from "@/lib/types";
import { AGE_CLASS_CONFIG, GENDER_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const genderFilters: { value: Gender | "all"; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "female", label: GENDER_LABELS.female },
  { value: "male", label: GENDER_LABELS.male },
];

function getGenderColor(gender: Gender) {
  return gender === "female"
    ? { bg: "bg-primary", text: "text-primary-foreground" }
    : { bg: "bg-secondary", text: "text-secondary-foreground" };
}

function formatMatchDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
  const day = d.getDate();
  const month = d.toLocaleDateString("de-DE", { month: "short" }).replace(".", "");
  return `${weekday}, ${day}. ${month}`;
}

function formatTime(t: string | null) {
  if (!t) return null;
  return t.slice(0, 5);
}

function getCountdown(iso: string): { label: string; urgent: boolean } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return { label: "Heute", urgent: true };
  if (diff === 1) return { label: "Morgen", urgent: true };
  if (diff <= 7) return { label: `in ${diff} Tagen`, urgent: false };
  return null;
}

interface TeamsViewProps {
  initialTeams: Team[];
  initialNextMatches: Record<string, Match>;
  initialMatchCounts: Record<string, number>;
  profile: UserProfile;
}

export function TeamsView({ initialTeams, initialNextMatches, initialMatchCounts, profile }: TeamsViewProps) {
  const [teams, setTeams] = useState(initialTeams);
  const [nextMatches, setNextMatches] = useState<Record<string, Match>>(initialNextMatches);
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>(initialMatchCounts);
  const [genderFilter, setGenderFilter] = useState<Gender | "all">("all");
  const router = useRouter();
  const params = useParams<{ clubSlug: string }>();

  const isAdmin = profile.role === "admin";
  const userTeamIds = new Set(profile.teams?.map((t) => t.id) ?? []);

  const refresh = async () => {
    const [data, next, counts] = await Promise.all([
      getTeams(),
      getNextMatches(),
      getPendingMatchCounts(),
    ]);
    setTeams(data);
    setNextMatches(next);
    setMatchCounts(counts);
  };

  const filtered = genderFilter === "all" ? teams : teams.filter((t) => t.gender === genderFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Teams</h2>
        {isAdmin && <TeamForm onDone={refresh} />}
      </div>

      {/* Gender filter */}
      <div className="inline-flex items-center bg-muted p-1">
        {genderFilters.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            onClick={() => setGenderFilter(value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              genderFilter === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Team cards */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Keine Teams vorhanden</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => {
            const canAccess = isAdmin || userTeamIds.has(team.id);
            const ageLabel = AGE_CLASS_CONFIG[team.age_class]?.label ?? team.age_class;
            const color = getGenderColor(team.gender);
            const nextMatch = nextMatches?.[team.id] ?? null;
            const pendingCount = matchCounts?.[team.id] ?? 0;
            const countdown = nextMatch ? getCountdown(nextMatch.match_date) : null;
            const opponent = nextMatch ? (nextMatch.is_home ? nextMatch.away_team : nextMatch.home_team) : null;

            return (
              <button
                type="button"
                key={team.id}
                disabled={!canAccess}
                className={cn(
                  "group relative flex w-full flex-col overflow-hidden border bg-card text-left transition-all",
                  canAccess
                    ? "cursor-pointer hover:shadow-lg hover:border-foreground/20"
                    : "opacity-50 grayscale-[30%]"
                )}
                onClick={canAccess ? () => router.push(`/${params.clubSlug}/team/${team.gender}/${team.slug}`) : undefined}
              >
                {/* Colored header band */}
                <div className={cn("relative px-5 py-4", color.bg, color.text)}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate font-display text-xl uppercase tracking-wide leading-tight">
                      {team.name}
                    </h3>
                    {canAccess ? (
                      <ChevronRight className="h-5 w-5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0 opacity-40" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-75">
                    <span>{GENDER_LABELS[team.gender]}</span>
                    {ageLabel !== "Alle" && (
                      <>
                        <span className="opacity-40">|</span>
                        <span>{ageLabel}</span>
                      </>
                    )}
                    <span className="opacity-40">|</span>
                    <span>{team.team_size}er</span>
                  </div>
                  {team.league && (
                    <p className="mt-1 text-[11px] normal-case tracking-normal font-semibold opacity-60">
                      {team.league}
                    </p>
                  )}
                </div>

                {/* Next match / bottom section */}
                <div className="flex-1 px-5 py-4">
                  {nextMatch ? (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          Nächstes Spiel
                        </span>
                        {countdown && (
                          <span className={cn(
                            "px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            countdown.urgent
                              ? "bg-destructive text-white"
                              : "bg-sage text-white"
                          )}>
                            {countdown.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-foreground leading-tight">
                        {opponent}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className={cn(
                          "flex items-center gap-1 font-semibold",
                          nextMatch.is_home ? "text-verdigris" : "text-cerulean"
                        )}>
                          {nextMatch.is_home
                            ? <><Home className="h-3 w-3" /> Heim</>
                            : <><Globe className="h-3 w-3" /> Auswärts</>
                          }
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatMatchDate(nextMatch.match_date)}
                          {formatTime(nextMatch.match_time) && `, ${formatTime(nextMatch.match_time)}`}
                        </span>
                      </div>
                      {pendingCount > 1 && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          +{pendingCount - 1} weitere {pendingCount - 1 === 1 ? "Spiel" : "Spiele"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="py-1 text-sm text-muted-foreground">
                      Keine anstehenden Spiele
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

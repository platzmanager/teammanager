"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, UserMinus, UserPlus, Loader2, List, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Team, Player, Match } from "@/lib/types";
import { getAge } from "@/lib/players";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { TeamDetailSheet } from "@/components/team-detail-sheet";
import { removeCaptain, inviteCaptain } from "@/actions/teams";

export interface Captain {
  id: string;
  email: string;
}

interface TeamDetailClientProps {
  team: Team;
  captains: Captain[];
  players: Player[];
  blockedCount: number;
  matches: Match[];
  isAdmin: boolean;
  clubSlug: string;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(t: string | null) {
  if (!t) return null;
  return t.slice(0, 5) + " Uhr";
}

export function TeamDetailClient({ team, captains: initialCaptains, players, blockedCount, matches, isAdmin, clubSlug }: TeamDetailClientProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [captains, setCaptains] = useState(initialCaptains);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);

  const blockedPlayers = players.slice(0, blockedCount);
  const corePlayers = players.slice(blockedCount, blockedCount + team.team_size);
  const remainingPlayers = players.slice(blockedCount + team.team_size);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleRemoveCaptain(userId: string) {
    if (!confirm("Mannschaftsführer wirklich entfernen?")) return;
    await removeCaptain(team.id, userId);
    setCaptains((prev) => prev.filter((c) => c.id !== userId));
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const captain = await inviteCaptain(team.id, inviteEmail.trim());
        setCaptains((prev) => [...prev.filter((c) => c.id !== captain.id), captain]);
        setInviteEmail("");
        toast.success("Mannschaftsführer eingeladen");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Einladen");
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <nav className="sm:hidden">
          <Link
            href={`/${clubSlug}/teams`}
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="mr-1 -ml-1 h-5 w-5 shrink-0" />
            Teams
          </Link>
        </nav>
        <nav aria-label="Breadcrumb" className="hidden sm:flex">
          <ol role="list" className="flex items-center space-x-2">
            <li className="flex items-center">
              <Link href={`/${clubSlug}/teams`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Teams
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground/60" />
              <span className="ml-2 text-sm font-medium text-muted-foreground">{team.name}</span>
            </li>
          </ol>
        </nav>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-2xl/7 font-bold sm:truncate sm:text-3xl sm:tracking-tight">{team.name}</h2>
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Captains */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Mannschaftsführer</h3>
        {captains.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Mannschaftsführer zugeordnet</p>
        ) : (
          <ul className="space-y-2">
            {captains.map((captain) => (
              <li key={captain.id} className="flex items-center justify-between rounded-md border bg-white px-4 py-2">
                <span className="text-sm">{captain.email}</span>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCaptain(captain.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form onSubmit={handleInvite} className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="E-Mail-Adresse"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="max-w-xs"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              <span className="ml-1">Einladen</span>
            </Button>
          </form>
        )}
      </section>

      {/* Registered players */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gemeldete Spieler ({players.length})</h3>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${clubSlug}/players/${team.gender}/${team.age_class}`}>
              <List className="mr-2 h-4 w-4" />
              Meldeliste bearbeiten
            </Link>
          </Button>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Spieler gemeldet.</p>
        ) : (
          <div className="rounded-md border bg-white">
            {blockedPlayers.length > 0 && (
              <button
                onClick={() => setShowBlocked(!showBlocked)}
                className="flex w-full items-center justify-center gap-1 border-b py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showBlocked ? (
                  <>Gesperrte Spieler ausblenden <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>{blockedPlayers.length} gesperrte Spieler <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Alter</TableHead>
                  <TableHead className="text-center">LK</TableHead>
                  <TableHead>Lizenz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showBlocked && blockedPlayers.map((player, i) => (
                  <TableRow key={player.uuid} className="text-muted-foreground">
                    <TableCell className="font-medium">{i + 1}</TableCell>
                    <TableCell>{player.last_name}, {player.first_name}</TableCell>
                    <TableCell className="text-center">{getAge(player.birth_date)}</TableCell>
                    <TableCell className="text-center">{player.skill_level ?? "–"}</TableCell>
                    <TableCell>{player.license || "—"}</TableCell>
                  </TableRow>
                ))}
                {corePlayers.map((player, i) => (
                  <TableRow key={player.uuid}>
                    <TableCell className="font-medium">{blockedCount + i + 1}</TableCell>
                    <TableCell>{player.last_name}, {player.first_name}</TableCell>
                    <TableCell className="text-center">{getAge(player.birth_date)}</TableCell>
                    <TableCell className="text-center">{player.skill_level ?? "–"}</TableCell>
                    <TableCell>{player.license || "—"}</TableCell>
                  </TableRow>
                ))}
                {showRemaining && remainingPlayers.map((player, i) => (
                  <TableRow key={player.uuid}>
                    <TableCell className="font-medium">{blockedCount + team.team_size + i + 1}</TableCell>
                    <TableCell>{player.last_name}, {player.first_name}</TableCell>
                    <TableCell className="text-center">{getAge(player.birth_date)}</TableCell>
                    <TableCell className="text-center">{player.skill_level ?? "–"}</TableCell>
                    <TableCell>{player.license || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {remainingPlayers.length > 0 && (
              <button
                onClick={() => setShowRemaining(!showRemaining)}
                className="flex w-full items-center justify-center gap-1 border-t py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showRemaining ? (
                  <>Weniger anzeigen <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>{remainingPlayers.length} weitere Spieler <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Spieltage */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Spieltage ({matches.length})</h3>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Spieltage geplant.</p>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <div key={match.id} className="flex items-start gap-3 rounded-md border bg-white px-4 py-3">
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {match.home_team} – {match.away_team}
                    </span>
                    {match.is_home && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Heim</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDate(match.match_date)}{match.match_time ? `, ${formatTime(match.match_time)}` : ""}</span>
                    {match.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {match.location}
                      </span>
                    )}
                    {match.match_number && <span>Spiel-Nr. {match.match_number}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <TeamDetailSheet
          team={team}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          clubSlug={clubSlug}
        />
      )}
    </div>
  );
}

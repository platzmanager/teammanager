"use client";

import { Check, HelpCircle, Loader2, Users, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateLineup } from "@/actions/lineup";
import type { EventResponse, MatchLineup, Player, RsvpResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlayerWithRsvp {
  player: Player;
  rsvp: RsvpResponse | null;
  matchCount: number;
  inLineup: boolean;
}

interface LineupEditorProps {
  matchId: string;
  players: Player[];
  responses: EventResponse[];
  lineup: MatchLineup[];
  matchCounts: Record<string, number>;
  isCaptain: boolean;
  teamSize: number;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const RSVP_BADGE: Record<RsvpResponse, { label: string; icon: typeof Check; color: string }> = {
  yes: { label: "Ja", icon: Check, color: "text-verdigris bg-verdigris/15" },
  maybe: { label: "Vllt.", icon: HelpCircle, color: "text-golden bg-golden/15" },
  no: { label: "Nein", icon: X, color: "text-destructive bg-destructive/15" },
};

export function LineupEditor({
  matchId,
  players,
  responses,
  lineup,
  matchCounts,
  isCaptain,
  teamSize,
}: LineupEditorProps) {
  const lineupUuids = useMemo(() => new Set(lineup.map((l) => l.player_uuid)), [lineup]);
  const [selected, setSelected] = useState<Set<string>>(lineupUuids);
  const [isPending, startTransition] = useTransition();

  // Build a map: player_uuid → RSVP response (via members)
  const playerRsvpMap = useMemo(() => {
    const map = new Map<string, RsvpResponse>();
    for (const r of responses) {
      if (r.member?.player_uuid) {
        map.set(r.member.player_uuid, r.response);
      }
    }
    return map;
  }, [responses]);

  // Build enriched player list sorted by sort_position
  const enrichedPlayers = useMemo(() => {
    return players
      .map((p): PlayerWithRsvp => ({
        player: p,
        rsvp: playerRsvpMap.get(p.uuid) ?? null,
        matchCount: matchCounts[p.uuid] ?? 0,
        inLineup: selected.has(p.uuid),
      }))
      .sort((a, b) => {
        // Available (yes/maybe) first, then no response, then declined
        const rsvpOrder = (r: RsvpResponse | null) =>
          r === "yes" ? 0 : r === "maybe" ? 1 : r === null ? 2 : 3;
        const orderDiff = rsvpOrder(a.rsvp) - rsvpOrder(b.rsvp);
        if (orderDiff !== 0) return orderDiff;
        return a.player.sort_position - b.player.sort_position;
      });
  }, [players, playerRsvpMap, matchCounts, selected]);

  // Lineup players sorted by sort_position
  const lineupPlayers = useMemo(() => {
    return players
      .filter((p) => selected.has(p.uuid))
      .sort((a, b) => a.sort_position - b.sort_position);
  }, [players, selected]);

  function togglePlayer(uuid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  }

  function handleSave() {
    const uuids = players
      .filter((p) => selected.has(p.uuid))
      .sort((a, b) => a.sort_position - b.sort_position)
      .map((p) => p.uuid);

    startTransition(async () => {
      try {
        await updateLineup(matchId, uuids);
        toast.success("Aufstellung gespeichert");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const hasChanges = useMemo(() => {
    if (selected.size !== lineupUuids.size) return true;
    for (const uuid of selected) {
      if (!lineupUuids.has(uuid)) return true;
    }
    return false;
  }, [selected, lineupUuids]);

  // Read-only view for non-captains
  if (!isCaptain) {
    if (lineupPlayers.length === 0) return null;
    return (
      <div className="border border-border">
        <div className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b border-border bg-muted/30">
          <Users className="h-4 w-4" />
          <span>Aufstellung ({lineupPlayers.length})</span>
        </div>
        {lineupPlayers.map((p, i) => (
          <div
            key={p.uuid}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5",
              i < lineupPlayers.length - 1 && "border-b border-border"
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold text-white bg-cerulean">
              {getInitials(p.first_name, p.last_name)}
            </div>
            <span className="text-sm">{p.first_name} {p.last_name}</span>
          </div>
        ))}
      </div>
    );
  }

  // Captain editor view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          Aufstellung
        </h2>
        <span className={cn(
          "text-sm font-bold tabular-nums",
          selected.size === teamSize ? "text-verdigris" : "text-muted-foreground"
        )}>
          {selected.size}/{teamSize}
        </span>
      </div>

      <div className="border border-border">
        {enrichedPlayers.map((ep, i) => {
          const { player: p, rsvp, matchCount, inLineup } = ep;
          const isDeclined = rsvp === "no";
          const badge = rsvp ? RSVP_BADGE[rsvp] : null;
          const BadgeIcon = badge?.icon;

          return (
            <button
              key={p.uuid}
              type="button"
              onClick={() => togglePlayer(p.uuid)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                i < enrichedPlayers.length - 1 && "border-b border-border",
                isDeclined && !inLineup && "opacity-40",
              )}
            >
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold transition-colors",
                inLineup
                  ? "bg-cerulean text-white"
                  : "bg-muted text-muted-foreground"
              )}>
                {inLineup ? <Check className="h-4 w-4" /> : getInitials(p.first_name, p.last_name)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm">{p.first_name} {p.last_name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {matchCount > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {matchCount} {matchCount === 1 ? "Einsatz" : "Einsätze"}
                  </span>
                )}
                {badge && BadgeIcon && (
                  <span className={cn("flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold", badge.color)}>
                    <BadgeIcon className="h-3 w-3" />
                    {badge.label}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {hasChanges && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-wide bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Aufstellung speichern
        </button>
      )}
    </div>
  );
}

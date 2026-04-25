"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus, UtensilsCrossed, CheckCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { upsertMealClaim } from "@/actions/meals";

interface MatchWithClaim {
  id: string;
  match_date: string;
  match_time: string | null;
  home_team: string;
  away_team: string;
  location: string | null;
  meal_claims: {
    id: string;
    meal_count: number;
    amount_per_meal: number;
    notes: string | null;
    status: "submitted" | "confirmed" | "settled";
  }[] | null;
}

interface MealClaimTabProps {
  homeMatches: MatchWithClaim[];
  amountPerMeal?: number;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatTime(t: string | null) {
  return t ? t.slice(0, 5) + " Uhr" : "";
}

function MealClaimCard({ match, defaultAmount }: { match: MatchWithClaim; defaultAmount: number }) {
  const existing = match.meal_claims?.[0] ?? null;
  const isLocked = existing?.status === "confirmed" || existing?.status === "settled";

  const [count, setCount] = useState(existing?.meal_count ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const amount = count * (existing?.amount_per_meal ?? defaultAmount);

  function handleSave() {
    startTransition(async () => {
      try {
        await upsertMealClaim(match.id, count, notes);
        setDirty(false);
        toast.success("Essensmeldung gespeichert");
      } catch (e: any) {
        toast.error(e.message ?? "Fehler beim Speichern");
      }
    });
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-none border transition-colors md:rounded-lg",
      isLocked ? "border-border bg-muted/30" : "border-border bg-card"
    )}>
      {/* Match header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div>
          <p className="font-display text-lg tracking-wider text-foreground">
            vs. {match.away_team}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(match.match_date)}{match.match_time ? ` · ${formatTime(match.match_time)}` : ""}
            {match.location ? ` · ${match.location}` : ""}
          </p>
        </div>
        {existing ? (
          <Badge
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              existing.status === "confirmed" && "bg-green-600 text-white",
              existing.status === "settled" && "bg-blue-600 text-white",
              existing.status === "submitted" && "border-primary text-primary"
            )}
            variant={existing.status === "submitted" ? "outline" : "default"}
          >
            {existing.status === "submitted" ? "Gemeldet" : existing.status === "confirmed" ? "Bestätigt" : "Abgerechnet"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Nicht gemeldet
          </Badge>
        )}
      </div>

      {/* Form */}
      <div className="px-4 py-4 space-y-4">
        {/* Counter */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-28">
            Anzahl Essen:
          </span>
          <div className="flex items-center gap-3">
            <button
              disabled={isLocked || count <= 0}
              onClick={() => { setCount((c) => Math.max(0, c - 1)); setDirty(true); }}
              className={cn(
                "flex h-8 w-8 items-center justify-center border-2 border-primary text-primary font-bold text-lg transition-opacity",
                (isLocked || count <= 0) ? "opacity-30 cursor-not-allowed" : "hover:bg-primary hover:text-white"
              )}
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-bold tabular-nums">{count}</span>
            <button
              disabled={isLocked || count >= 20}
              onClick={() => { setCount((c) => Math.min(20, c + 1)); setDirty(true); }}
              className={cn(
                "flex h-8 w-8 items-center justify-center border-2 border-primary text-primary font-bold text-lg transition-opacity",
                (isLocked || count >= 20) ? "opacity-30 cursor-not-allowed" : "hover:bg-primary hover:text-white"
              )}
            >
              +
            </button>
            <span className="text-xs text-muted-foreground italic">
              à {(existing?.amount_per_meal ?? defaultAmount).toFixed(2)} €
            </span>
          </div>
        </div>

        {/* Notes */}
        <Textarea
          placeholder="Anmerkung (optional)"
          value={notes}
          disabled={isLocked}
          onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          rows={2}
          className="text-sm resize-none"
        />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            <span className="font-bold">{amount.toFixed(2)} €</span>
            {isLocked && <Lock className="ml-2 h-3 w-3 text-muted-foreground" />}
          </div>
          {!isLocked && (
            <Button
              size="sm"
              disabled={!dirty || isPending}
              onClick={handleSave}
              className="font-bold uppercase tracking-wider"
            >
              {isPending ? "Speichern…" : "Speichern"}
            </Button>
          )}
          {isLocked && existing?.status === "confirmed" && (
            <div className="flex items-center gap-1 text-xs text-green-600 font-bold">
              <CheckCircle className="h-3 w-3" /> Bestätigt durch Gastronomie
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MealClaimTab({ homeMatches, amountPerMeal = 10 }: MealClaimTabProps) {
  if (homeMatches.length === 0) {
    return (
      <div className="py-12 text-center">
        <UtensilsCrossed className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Keine Heimspiele vorhanden
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">
          Tragen Sie die Anzahl der Essen ein, die der Gegner nach dem Spiel erhält (0–20).
          Bestätigte Meldungen können nicht mehr geändert werden.
        </p>
      </div>
      {homeMatches.map((match) => (
        <MealClaimCard key={match.id} match={match} defaultAmount={amountPerMeal} />
      ))}
    </div>
  );
}

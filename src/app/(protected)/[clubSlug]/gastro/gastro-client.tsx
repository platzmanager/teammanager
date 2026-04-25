"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { CheckSquare, Square, UtensilsCrossed, Euro, ClipboardList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { confirmMealClaims } from "@/actions/meals";
import { MealSettingsForm } from "@/components/meal-settings-form";
import { BILLING_INTERVAL_LABELS, type MealClaim, type MealSettings } from "@/lib/types";

type FilterTab = "today" | "submitted" | "confirmed" | "all";

const FILTER_LABELS: Record<FilterTab, string> = {
  today: "Heute",
  submitted: "Offen",
  confirmed: "Bestätigt",
  all: "Alle",
};

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatTime(timeStr: string | null | undefined) {
  return timeStr ? timeStr.slice(0, 5) + " Uhr" : "";
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** Full calendar period for the current billing interval */
function getBillingPeriod(settings: MealSettings | null): { from: string; to: string; label: string } {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();
  const interval = settings?.billing_interval ?? "monthly";

  if (interval === "monthly") {
    // always 01. bis letzter Tag des aktuellen Kalendermonats
    const from = new Date(y, m, 1).toISOString().slice(0, 10);
    const to   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    return { from, to, label: `${MONTH_NAMES[m]} ${y}` };
  }

  if (interval === "quarterly") {
    const q    = Math.floor(m / 3);
    const from = new Date(y, q * 3, 1).toISOString().slice(0, 10);
    const to   = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10);
    return { from, to, label: `Q${q + 1} ${y}` };
  }

  if (interval === "yearly") {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  }

  // seasonal / custom
  const from = settings?.season_start ?? `${y}-01-01`;
  const to   = settings?.season_end   ?? `${y}-12-31`;
  return { from, to, label: `${from} – ${to}` };
}

// ─── Component ────────────────────────────────────────────────────

interface GastroClientProps {
  initialClaims: MealClaim[];
  settings: MealSettings | null;
  isAdmin: boolean;
}

export function GastroClient({ initialClaims, settings: initialSettings, isAdmin }: GastroClientProps) {
  const [claims, setClaims]     = useState(initialClaims);
  const [settings, setSettings] = useState<MealSettings | null>(initialSettings);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter]     = useState<FilterTab>("today");
  const [loading, setLoading]   = useState(false);

  const filtered = useMemo(() => {
    switch (filter) {
      case "today":
        return claims.filter((c) => c.match?.match_date && isToday(c.match.match_date));
      case "submitted":
        return claims.filter((c) => c.status === "submitted");
      case "confirmed":
        return claims.filter((c) => c.status === "confirmed");
      default:
        return claims;
    }
  }, [claims, filter]);

  const openClaims  = claims.filter((c) => c.status === "submitted");
  const totalMeals  = openClaims.reduce((s, c) => s + c.meal_count, 0);
  const totalAmount = openClaims.reduce((s, c) => s + c.meal_count * c.amount_per_meal, 0);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ids = filtered.filter((c) => c.status === "submitted").map((c) => c.id);
    if (selected.size === ids.length && ids.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ids));
    }
  }

  async function handleConfirm() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setLoading(true);
    try {
      await confirmMealClaims(ids);
      setClaims((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? { ...c, status: "confirmed" as const, confirmed_at: new Date().toISOString() }
            : c
        )
      );
      setSelected(new Set());
      toast.success(`${ids.length} Meldung${ids.length !== 1 ? "en" : ""} bestätigt`);
    } catch {
      toast.error("Fehler beim Bestätigen");
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadPDF() {
    const { from, to } = getBillingPeriod(settings);
    window.open(`/api/meals/report?from=${from}&to=${to}`, "_blank");
  }

  const submittedInView = filtered.filter((c) => c.status === "submitted");
  const allSubmittedSelected =
    submittedInView.length > 0 &&
    submittedInView.every((c) => selected.has(c.id));

  const { label: periodLabel, from: periodFrom, to: periodTo } = getBillingPeriod(settings);
  const intervalLabel = settings?.billing_interval
    ? BILLING_INTERVAL_LABELS[settings.billing_interval]
    : "Monatlich";

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="relative overflow-hidden rounded-none bg-primary px-6 py-6 text-white md:rounded-lg">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-golden/20" />
        <div className="absolute right-8 bottom-0 h-16 w-16 rounded-full bg-white/5" />
        <p className="font-display text-3xl md:text-4xl tracking-wider">ESSENS<br />ZUSCHUSS</p>
        <p className="mt-1 text-sm text-white/70">Meldungen prüfen · Bestätigen · Abrechnung</p>
      </div>

      {/* Admin settings panel */}
      {isAdmin && (
        <MealSettingsForm
          settings={settings}
          onSaved={(updated) => setSettings(updated)}
        />
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "OFFEN",  value: openClaims.length,             color: "text-primary" },
          { label: "ESSEN",  value: totalMeals,                    color: "text-foreground" },
          { label: "BETRAG", value: `${totalAmount.toFixed(0)} €`, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-none border border-border bg-card p-3 md:rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border">
        {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
              filter === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {FILTER_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {submittedInView.length > 0 && (
        <div className="flex items-center justify-between rounded-none border border-border bg-muted/50 px-4 py-2 md:rounded-lg">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {allSubmittedSelected
              ? <CheckSquare className="h-4 w-4 text-primary" />
              : <Square className="h-4 w-4" />
            }
            {allSubmittedSelected ? "Keine auswählen" : "Alle auswählen"}
          </button>
          <Button
            size="sm"
            disabled={selected.size === 0 || loading}
            onClick={handleConfirm}
            className="font-bold uppercase tracking-wider"
          >
            {selected.size > 0 ? `${selected.size} Bestätigen` : "Bestätigen"}
          </Button>
        </div>
      )}

      {/* Claims list */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Keine Meldungen
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => {
            const isSelected  = selected.has(claim.id);
            const isOpen      = claim.status === "submitted";
            const amount      = claim.meal_count * claim.amount_per_meal;
            const teamName    = (claim.match?.team as any)?.name ?? "–";
            const matchDate   = claim.match?.match_date ? formatDate(claim.match.match_date) : "–";
            const matchTime   = formatTime(claim.match?.match_time);
            const captainName = claim.captain
              ? `${claim.captain.first_name ?? ""} ${claim.captain.last_name ?? ""}`.trim()
              : "–";

            return (
              <div
                key={claim.id}
                onClick={() => isOpen && toggleSelect(claim.id)}
                className={cn(
                  "overflow-hidden rounded-none border transition-all md:rounded-lg",
                  isOpen && "cursor-pointer",
                  isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
              >
                <div className={cn(
                  "flex items-center justify-between px-4 py-3",
                  isSelected ? "bg-primary text-white" : "bg-muted/50"
                )}>
                  <div className="flex items-center gap-2">
                    {isOpen && (
                      isSelected
                        ? <CheckSquare className="h-4 w-4" />
                        : <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className={cn("font-display text-lg tracking-wider", isSelected ? "text-white" : "text-foreground")}>
                        {teamName}
                      </p>
                      <p className={cn("text-xs", isSelected ? "text-white/70" : "text-muted-foreground")}>
                        {matchDate}{matchTime ? ` · ${matchTime}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      claim.status === "confirmed" && "border-green-600 bg-green-600 text-white",
                      claim.status === "settled"   && "border-blue-600 bg-blue-600 text-white",
                    )}
                  >
                    {claim.status === "submitted" ? "Offen"
                      : claim.status === "confirmed" ? "Bestätigt"
                      : "Abgerechnet"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-bold text-sm">vs. {claim.match?.away_team ?? "–"}</p>
                    <p className="text-xs text-muted-foreground">
                      MF: {captainName}{claim.notes && ` · ${claim.notes}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-primary">{claim.meal_count}</p>
                    <p className="text-xs font-bold text-green-600">{amount.toFixed(2)} €</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PDF Download */}
      <div className="pt-2 pb-6 space-y-1">
        <Button
          variant="outline"
          onClick={handleDownloadPDF}
          className="w-full gap-2 font-bold uppercase tracking-wider border-primary text-primary hover:bg-primary hover:text-white"
        >
          <Download className="h-4 w-4" />
          PDF-Abrechnung herunterladen
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
          {intervalLabel} · {periodLabel} ({periodFrom} – {periodTo})
        </p>
      </div>
    </div>
  );
}

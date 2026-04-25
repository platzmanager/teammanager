"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertMealSettings } from "@/actions/meals";
import { BILLING_INTERVAL_LABELS, type BillingInterval, type MealSettings } from "@/lib/types";

interface MealSettingsFormProps {
  settings: MealSettings | null;
  onSaved?: (updated: MealSettings) => void;
}

export function MealSettingsForm({ settings, onSaved }: MealSettingsFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState(String(settings?.amount_per_meal ?? 10));
  const [interval, setInterval] = useState<BillingInterval>(
    settings?.billing_interval ?? "monthly"
  );
  const [email, setEmail] = useState(settings?.finance_email ?? "");
  const [from, setFrom] = useState(settings?.season_start ?? "");
  const [to, setTo] = useState(settings?.season_end ?? "");

  async function handleSave() {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Ungültiger Betrag");
      return;
    }
    if (interval === "seasonal" && (!from || !to)) {
      toast.error("Bitte Von- und Bis-Datum angeben");
      return;
    }
    setLoading(true);
    try {
      await upsertMealSettings({
        amount_per_meal: parsedAmount,
        billing_interval: interval,
        finance_email: email || undefined,
        season_start: interval === "seasonal" ? from : undefined,
        season_end: interval === "seasonal" ? to : undefined,
      });
      toast.success("Einstellungen gespeichert");
      onSaved?.({
        club_id: settings?.club_id ?? "",
        amount_per_meal: parsedAmount,
        billing_interval: interval,
        finance_email: email || null,
        season_start: interval === "seasonal" ? from : null,
        season_end: interval === "seasonal" ? to : null,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-none border border-border bg-card md:rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Einstellungen Essenszuschuss
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Form body */}
      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">

          {/* Amount per meal */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Betrag pro Essen (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Billing interval */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Abrechnungsintervall
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BILLING_INTERVAL_LABELS) as BillingInterval[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setInterval(key)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-bold transition-colors text-left",
                    interval === key
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  )}
                >
                  {BILLING_INTERVAL_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range — only when "seasonal" */}
          {interval === "seasonal" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Von
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Bis
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Finance email */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              E-Mail Finanzvorständin (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="finanzen@tc-thalkirchen.de"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={loading}
            className="w-full font-bold uppercase tracking-wider"
          >
            {loading ? "Speichern…" : "Einstellungen speichern"}
          </Button>
        </div>
      )}
    </div>
  );
}

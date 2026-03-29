"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { respondToEvent } from "@/actions/rsvp";
import type { EventResponse, RsvpResponse } from "@/lib/types";
import { RSVP_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface RsvpCounts {
  yes: number;
  maybe: number;
  no: number;
}

interface RsvpButtonsProps {
  occurrenceId: string;
  currentResponse?: EventResponse | null;
  counts?: RsvpCounts;
  onChange?: (response: RsvpResponse) => void;
}

const RSVP_CONFIG: Record<RsvpResponse, {
  icon: typeof Check | null;
  activeBg: string;
  inactiveBg: string;
}> = {
  yes: {
    icon: Check,
    activeBg: "bg-verdigris text-white",
    inactiveBg: "bg-verdigris/15 text-verdigris/70 hover:bg-verdigris/80 hover:text-white",
  },
  maybe: {
    icon: null,
    activeBg: "bg-golden text-white",
    inactiveBg: "bg-golden/15 text-golden/70 hover:bg-golden/80 hover:text-white",
  },
  no: {
    icon: X,
    activeBg: "bg-destructive text-white",
    inactiveBg: "bg-destructive/15 text-destructive/70 hover:bg-destructive/80 hover:text-white",
  },
};

export function RsvpButtons({ occurrenceId, currentResponse, counts, onChange }: RsvpButtonsProps) {
  const [current, setCurrent] = useState<RsvpResponse | null>(currentResponse?.response ?? null);
  const [optimisticCounts, setOptimisticCounts] = useState<RsvpCounts | undefined>(counts);
  const [isPending, startTransition] = useTransition();

  function handleClick(response: RsvpResponse) {
    const prev = current;
    setCurrent(response);
    onChange?.(response);
    if (optimisticCounts) {
      setOptimisticCounts((c) => {
        if (!c) return c;
        const next = { ...c };
        if (prev) next[prev] = Math.max(0, next[prev] - 1);
        next[response] += 1;
        return next;
      });
    }
    startTransition(async () => {
      try {
        await respondToEvent(occurrenceId, response);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setCurrent(currentResponse?.response ?? null);
        setOptimisticCounts(counts);
      }
    });
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {(["yes", "maybe", "no"] as RsvpResponse[]).map((r) => {
        const config = RSVP_CONFIG[r];
        const Icon = config.icon;
        const isActive = current === r;

        return (
          <button
            key={r}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(r)}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50",
              isActive ? config.activeBg : config.inactiveBg,
            )}
          >
            {isPending && isActive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : Icon ? (
              <Icon className="h-4 w-4" />
            ) : (
              <span className="text-sm font-bold leading-none">?</span>
            )}
            <span className="hidden sm:inline">{RSVP_LABELS[r]}</span>
            {optimisticCounts != null && (
              <span className="tabular-nums">({optimisticCounts[r]})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { Check, HelpCircle, Loader2, X } from "lucide-react";
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
  size?: "sm" | "default";
}

const RSVP_CONFIG: Record<RsvpResponse, {
  icon: typeof Check;
  activeBg: string;
  activeRing: string;
  inactiveBg: string;
}> = {
  yes: {
    icon: Check,
    activeBg: "bg-verdigris text-white",
    activeRing: "ring-2 ring-offset-2 ring-verdigris",
    inactiveBg: "bg-verdigris/15 text-verdigris/70 hover:bg-verdigris/80 hover:text-white",
  },
  maybe: {
    icon: HelpCircle,
    activeBg: "bg-golden text-white",
    activeRing: "ring-2 ring-offset-2 ring-golden",
    inactiveBg: "bg-golden/15 text-golden/70 hover:bg-golden/80 hover:text-white",
  },
  no: {
    icon: X,
    activeBg: "bg-destructive text-white",
    activeRing: "ring-2 ring-offset-2 ring-destructive",
    inactiveBg: "bg-destructive/15 text-destructive/70 hover:bg-destructive/80 hover:text-white",
  },
};

export function RsvpButtons({ occurrenceId, currentResponse, counts, onChange, size = "default" }: RsvpButtonsProps) {
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

  const isSmall = size === "sm";

  return (
    <div className={cn("grid grid-cols-3", isSmall ? "gap-1" : "gap-2")}>
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
              "flex items-center justify-center font-bold uppercase tracking-wide transition-all disabled:opacity-50",
              isSmall ? "gap-1.5 py-2 text-xs" : "gap-2 py-3 text-sm",
              isActive
                ? cn(config.activeBg, !isSmall && config.activeRing)
                : config.inactiveBg,
            )}
          >
            {isPending && isActive ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
            <span className={isSmall ? "hidden sm:inline" : ""}>{RSVP_LABELS[r]}</span>
            {optimisticCounts != null && (
              <span className="tabular-nums">({optimisticCounts[r]})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

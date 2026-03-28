"use client";

import { useState, useTransition } from "react";
import type { RsvpResponse, EventResponse } from "@/lib/types";
import { RSVP_LABELS } from "@/lib/types";
import { respondToEvent } from "@/actions/rsvp";
import { Check, HelpCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RsvpButtonsProps {
  occurrenceId: string;
  currentResponse?: EventResponse | null;
}

const RSVP_CONFIG: Record<RsvpResponse, {
  icon: typeof Check;
  activeBg: string;
  inactiveBg: string;
}> = {
  yes: {
    icon: Check,
    activeBg: "bg-verdigris text-white",
    inactiveBg: "bg-verdigris/25 text-verdigris hover:bg-verdigris/60 hover:text-white",
  },
  maybe: {
    icon: HelpCircle,
    activeBg: "bg-golden text-white",
    inactiveBg: "bg-golden/25 text-golden hover:bg-golden/60 hover:text-white",
  },
  no: {
    icon: X,
    activeBg: "bg-destructive text-white",
    inactiveBg: "bg-destructive/25 text-destructive hover:bg-destructive/60 hover:text-white",
  },
};

export function RsvpButtons({ occurrenceId, currentResponse }: RsvpButtonsProps) {
  const [current, setCurrent] = useState<RsvpResponse | null>(currentResponse?.response ?? null);
  const [isPending, startTransition] = useTransition();

  function handleClick(response: RsvpResponse) {
    setCurrent(response);
    startTransition(async () => {
      try {
        await respondToEvent(occurrenceId, response);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setCurrent(currentResponse?.response ?? null);
      }
    });
  }

  return (
    <div className="grid grid-cols-3 gap-1 px-4">
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
            ) : (
              <Icon className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{RSVP_LABELS[r]}</span>
          </button>
        );
      })}
    </div>
  );
}

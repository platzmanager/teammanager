"use client";

import { Check, HelpCircle, Loader2, MessageSquare, X } from "lucide-react";
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
  activeBorder: string;
  inactiveBg: string;
}> = {
  yes: {
    icon: Check,
    activeBg: "bg-verdigris text-white",
    activeBorder: "shadow-[inset_0_0_0_3px_oklch(0.62_0.13_192)]",
    inactiveBg: "bg-verdigris/15 text-verdigris/70 hover:bg-verdigris/80 hover:text-white",
  },
  maybe: {
    icon: HelpCircle,
    activeBg: "bg-golden text-white",
    activeBorder: "shadow-[inset_0_0_0_3px_oklch(0.83_0.14_85)]",
    inactiveBg: "bg-golden/15 text-golden/70 hover:bg-golden/80 hover:text-white",
  },
  no: {
    icon: X,
    activeBg: "bg-destructive text-white",
    activeBorder: "shadow-[inset_0_0_0_3px_oklch(0.55_0.20_28)]",
    inactiveBg: "bg-destructive/15 text-destructive/70 hover:bg-destructive/80 hover:text-white",
  },
};

export function RsvpButtons({ occurrenceId, currentResponse, counts, onChange, size = "default" }: RsvpButtonsProps) {
  const [current, setCurrent] = useState<RsvpResponse | null>(currentResponse?.response ?? null);
  const [optimisticCounts, setOptimisticCounts] = useState<RsvpCounts | undefined>(counts);
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState(currentResponse?.comment ?? "");
  const [showComment, setShowComment] = useState(false);
  const [isSavingComment, startCommentTransition] = useTransition();

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
        await respondToEvent(occurrenceId, response, comment || undefined);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setCurrent(currentResponse?.response ?? null);
        setOptimisticCounts(counts);
      }
    });
  }

  function handleSaveComment() {
    if (!current) return;
    startCommentTransition(async () => {
      try {
        await respondToEvent(occurrenceId, current, comment || undefined);
        setShowComment(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const isSmall = size === "sm";
  const hasComment = comment.trim().length > 0;

  return (
    <div>
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
                  ? cn(config.activeBg, config.activeBorder)
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

      {current && !isSmall && (
        <div className="mt-2">
          {!showComment ? (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {hasComment ? "Kommentar bearbeiten" : "Kommentar hinzufügen"}
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 200))}
                placeholder="z.B. Kann nur zum Einzel..."
                rows={2}
                className="w-full border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{comment.length}/200</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowComment(false)}
                    className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    disabled={isSavingComment}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase bg-foreground text-background hover:bg-foreground/80 transition-colors disabled:opacity-50"
                  >
                    {isSavingComment && <Loader2 className="h-3 w-3 animate-spin" />}
                    Speichern
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

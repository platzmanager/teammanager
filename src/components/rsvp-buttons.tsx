"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RsvpResponse, RSVP_LABELS, EventResponse } from "@/lib/types";
import { respondToEvent } from "@/actions/rsvp";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RsvpButtonsProps {
  occurrenceId: string;
  currentResponse?: EventResponse | null;
}

const RSVP_STYLES: Record<RsvpResponse, { active: string; inactive: string }> = {
  yes: { active: "bg-green-600 text-white hover:bg-green-700", inactive: "hover:bg-green-50 hover:text-green-700" },
  maybe: { active: "bg-yellow-500 text-white hover:bg-yellow-600", inactive: "hover:bg-yellow-50 hover:text-yellow-700" },
  no: { active: "bg-red-600 text-white hover:bg-red-700", inactive: "hover:bg-red-50 hover:text-red-700" },
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
    <div className="flex gap-1">
      {(["yes", "maybe", "no"] as RsvpResponse[]).map((r) => (
        <Button
          key={r}
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => handleClick(r)}
          className={`text-xs px-2 py-1 h-7 ${current === r ? RSVP_STYLES[r].active : RSVP_STYLES[r].inactive}`}
        >
          {isPending && current === r ? <Loader2 className="h-3 w-3 animate-spin" /> : RSVP_LABELS[r]}
        </Button>
      ))}
    </div>
  );
}

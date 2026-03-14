"use client";

import { EventResponse, RSVP_LABELS, RsvpResponse } from "@/lib/types";

interface RsvpSummaryProps {
  responses: EventResponse[];
  compact?: boolean;
}

export function RsvpSummary({ responses, compact }: RsvpSummaryProps) {
  const counts: Record<RsvpResponse, number> = { yes: 0, no: 0, maybe: 0 };
  for (const r of responses) {
    counts[r.response]++;
  }

  if (compact) {
    return (
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="text-green-600">{counts.yes} {RSVP_LABELS.yes}</span>
        <span className="text-yellow-600">{counts.maybe} {RSVP_LABELS.maybe}</span>
        <span className="text-red-600">{counts.no} {RSVP_LABELS.no}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-sm">
        <span className="text-green-600 font-medium">{counts.yes} {RSVP_LABELS.yes}</span>
        <span className="text-yellow-600 font-medium">{counts.maybe} {RSVP_LABELS.maybe}</span>
        <span className="text-red-600 font-medium">{counts.no} {RSVP_LABELS.no}</span>
      </div>
      {responses.length > 0 && (
        <ul className="space-y-1">
          {responses.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  r.response === "yes"
                    ? "text-green-600"
                    : r.response === "no"
                    ? "text-red-600"
                    : "text-yellow-600"
                }
              >
                {RSVP_LABELS[r.response]}
              </span>
              <span>{r.member?.first_name} {r.member?.last_name}</span>
              {r.comment && <span className="text-muted-foreground">– {r.comment}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

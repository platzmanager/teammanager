"use client";

import { EventOccurrence, EventResponse } from "@/lib/types";
import { EventCard } from "./event-card";

interface EventListProps {
  occurrences: EventOccurrence[];
  myResponses?: Record<string, EventResponse>;
  showRsvp?: boolean;
}

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export function EventList({ occurrences, myResponses = {}, showRsvp = true }: EventListProps) {
  if (occurrences.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine anstehenden Termine.</p>;
  }

  // Group by month
  const grouped: { label: string; items: EventOccurrence[] }[] = [];
  let currentLabel = "";
  for (const occ of occurrences) {
    const label = getMonthLabel(occ.start_date);
    if (label !== currentLabel) {
      currentLabel = label;
      grouped.push({ label, items: [] });
    }
    grouped[grouped.length - 1].items.push(occ);
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">{group.label}</h4>
          <div className="space-y-2">
            {group.items.map((occ) => (
              <EventCard
                key={occ.id}
                occurrence={occ}
                myResponse={myResponses[occ.id]}
                showRsvp={showRsvp}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

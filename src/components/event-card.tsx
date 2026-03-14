"use client";

import { EventOccurrence, EVENT_TYPE_LABELS, EventResponse } from "@/lib/types";
import { Calendar, MapPin } from "lucide-react";
import { RsvpButtons } from "./rsvp-buttons";

interface EventCardProps {
  occurrence: EventOccurrence;
  myResponse?: EventResponse | null;
  showRsvp?: boolean;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(t: string | null) {
  if (!t) return null;
  return t.slice(0, 5) + " Uhr";
}

export function EventCard({ occurrence, myResponse, showRsvp = true }: EventCardProps) {
  const event = occurrence.event;
  const match = occurrence.match;
  const isMatch = event?.event_type === "match" && match;

  return (
    <div className={`flex items-start gap-3 rounded-md border bg-white px-4 py-3 ${occurrence.cancelled ? "opacity-50" : ""}`}>
      <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        {isMatch ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {match.home_team} – {match.away_team}
              </span>
              {match.is_home && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Heim</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{formatDate(occurrence.start_date)}{occurrence.start_time ? `, ${formatTime(occurrence.start_time)}` : ""}</span>
              {match.location && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {match.location}
                </span>
              )}
              {match.match_number && <span>Spiel-Nr. {match.match_number}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium">{event?.title}</span>
              {event && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.event_type]}
                </span>
              )}
              {occurrence.cancelled && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">Abgesagt</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{formatDate(occurrence.start_date)}{occurrence.start_time ? `, ${formatTime(occurrence.start_time)}` : ""}</span>
              {occurrence.end_time && <span>bis {formatTime(occurrence.end_time)}</span>}
              {event?.location && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </span>
              )}
            </div>
            {event?.description && (
              <p className="text-xs text-muted-foreground">{event.description}</p>
            )}
          </>
        )}
        {showRsvp && !occurrence.cancelled && (
          <div className="pt-1">
            <RsvpButtons occurrenceId={occurrence.id} currentResponse={myResponse} />
          </div>
        )}
      </div>
    </div>
  );
}

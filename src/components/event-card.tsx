"use client";

import type { EventOccurrence, EventResponse, RsvpResponse } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Home, MapPin, Globe, Check, HelpCircle, X } from "lucide-react";
import { RsvpButtons } from "./rsvp-buttons";
import { cn } from "@/lib/utils";

interface EventCardProps {
  occurrence: EventOccurrence;
  myResponse?: EventResponse | null;
  showRsvp?: boolean;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).getDate().toString();
}

function formatWeekdayShort(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "").toUpperCase();
}

function formatMonthShort(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", { month: "short" }).replace(".", "").toUpperCase();
}

function formatTime(t: string | null) {
  if (!t) return null;
  return t.slice(0, 5);
}

function getCountdown(iso: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return null;
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays <= 7) return `${diffDays} Tage`;
  return null;
}

function getCountdownColor(c: string): string {
  if (c === "Heute") return "bg-destructive text-white";
  if (c === "Morgen") return "bg-orange text-white";
  return "bg-sage text-white";
}

function getDateBlockColor(isMatch: boolean, isHome?: boolean): string {
  if (!isMatch) return "bg-cerulean";
  return isHome ? "bg-verdigris" : "bg-cerulean";
}

function getRsvpCounts(responses?: EventOccurrence["responses"]) {
  const counts = { yes: 0, maybe: 0, no: 0 };
  if (!responses) return counts;
  for (const r of responses) {
    const resp = "response" in r ? r.response : null;
    if (resp === "yes") counts.yes++;
    else if (resp === "maybe") counts.maybe++;
    else if (resp === "no") counts.no++;
  }
  return counts;
}

export function EventCard({ occurrence, myResponse, showRsvp = true }: EventCardProps) {
  const event = occurrence.event;
  const match = occurrence.match;
  const isMatch = event?.event_type === "match" && match;
  const countdown = getCountdown(occurrence.start_date);
  const time = formatTime(occurrence.start_time);
  const counts = getRsvpCounts(occurrence.responses);
  const hasResponses = counts.yes + counts.maybe + counts.no > 0;

  const opponent = isMatch ? (match.is_home ? match.away_team : match.home_team) : null;
  const location = isMatch ? match.location : event?.location;
  const dateColor = getDateBlockColor(!!isMatch, isMatch ? match.is_home : undefined);

  return (
    <div className={cn("overflow-hidden", occurrence.cancelled && "opacity-50")}>
      <div className="flex">
        {/* ── DATE BLOCK ── */}
        <div className={cn("flex w-20 shrink-0 flex-col items-center self-start py-4 text-white", dateColor)}>
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">
            {formatWeekdayShort(occurrence.start_date)}
          </span>
          <span className="font-display text-4xl leading-none">
            {formatDay(occurrence.start_date)}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">
            {formatMonthShort(occurrence.start_date)}
          </span>
        </div>

        {/* ── RIGHT SIDE ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Content */}
          <div className="flex-1 px-4 py-3">
            {/* Opponent / Title — largest element */}
            {isMatch ? (
              <p className="text-lg font-bold leading-tight text-foreground">
                {opponent}
              </p>
            ) : (
              <p className="text-lg font-bold leading-tight text-foreground">
                {event?.title}
              </p>
            )}

            {/* Meta line */}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {isMatch && (
                <span className={cn(
                  "flex items-center gap-1 text-[11px] font-bold uppercase",
                  match.is_home ? "text-verdigris" : "text-cerulean"
                )}>
                  {match.is_home ? <Home className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                  {match.is_home ? "Heimspiel" : "Auswärts"}{time && ` um ${time}`}
                </span>
              )}
              {!isMatch && (
                <span className="text-[11px] font-bold uppercase text-sage">
                  {event && EVENT_TYPE_LABELS[event.event_type]}{time && ` um ${time}`}
                </span>
              )}
              {countdown && (
                <span className={cn("px-1.5 py-0.5 text-[10px] font-bold uppercase", getCountdownColor(countdown))}>
                  {countdown}
                </span>
              )}
            </div>

            {occurrence.cancelled && (
              <span className="mt-1.5 inline-block bg-destructive text-white px-2 py-0.5 text-[10px] font-bold uppercase">
                Abgesagt
              </span>
            )}

            {!isMatch && event?.description && (
              <p className="mt-1.5 text-xs text-muted-foreground">{event.description}</p>
            )}

            {/* Location */}
            {location && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-cerulean hover:text-cerulean/70 transition-colors"
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="underline-offset-2 hover:underline">{location}</span>
              </a>
            )}

            {/* RSVP summary */}
            {hasResponses && (
              <div className="mt-2 flex items-center gap-3">
                {counts.yes > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-verdigris">
                    <Check className="h-3 w-3" />{counts.yes}
                  </span>
                )}
                {counts.maybe > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-golden">
                    <HelpCircle className="h-3 w-3" />{counts.maybe}
                  </span>
                )}
                {counts.no > 0 && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold text-destructive">
                    <X className="h-3 w-3" />{counts.no}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* RSVP Buttons */}
          {showRsvp && !occurrence.cancelled && (
            <RsvpButtons occurrenceId={occurrence.id} currentResponse={myResponse} />
          )}
        </div>
      </div>
    </div>
  );
}

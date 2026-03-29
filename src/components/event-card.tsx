"use client";

import { Check, ChevronRight, Globe, Home, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { EventOccurrence, EventResponse, RsvpResponse } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RsvpButtons } from "./rsvp-buttons";

interface EventCardProps {
  occurrence: EventOccurrence;
  myResponse?: EventResponse | null;
  showRsvp?: boolean;
  clubSlug?: string;
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

function getDateBlockColor(response?: string | null): string {
  switch (response) {
    case "yes": return "bg-verdigris";
    case "maybe": return "bg-golden";
    case "no": return "bg-destructive";
    default: return "bg-[#D4B483]";
  }
}

export function EventCard({ occurrence, myResponse, showRsvp = true, clubSlug }: EventCardProps) {
  const [optimisticResponse, setOptimisticResponse] = useState<RsvpResponse | null>(myResponse?.response ?? null);
  const event = occurrence.event;
  const match = occurrence.match;
  const isMatch = event?.event_type === "match" && match;
  const countdown = getCountdown(occurrence.start_date);
  const time = formatTime(occurrence.start_time);

  const opponent = isMatch ? (match.is_home ? match.away_team : match.home_team) : null;
  const location = isMatch ? match.location : event?.location;
  const dateColor = getDateBlockColor(optimisticResponse);

  const dateBlock = (
    <div className={cn("flex w-20 shrink-0 flex-col items-center justify-center text-white", dateColor)}>
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
  );

  const rsvpBadge = optimisticResponse ? (() => {
    const RsvpIcon = optimisticResponse === "yes" ? Check : optimisticResponse === "no" ? X : null;
    const rsvpColor = optimisticResponse === "yes" ? "bg-verdigris/15 text-verdigris" : optimisticResponse === "maybe" ? "bg-golden/15 text-golden" : "bg-destructive/15 text-destructive";
    const rsvpLabel = optimisticResponse === "yes" ? "Dabei" : optimisticResponse === "maybe" ? "Unsicher" : "Nicht dabei";
    return (
      <span className={cn("ml-auto flex items-center gap-1 px-1.5 text-[10px] font-bold uppercase shrink-0", rsvpColor)}>
        {RsvpIcon ? <RsvpIcon className="h-3 w-3" /> : <span className="text-[10px] font-bold">?</span>}
        {rsvpLabel}
      </span>
    );
  })() : null;

  const titleContent = (
    <p className="text-lg font-bold leading-tight text-foreground">
      {isMatch ? opponent : event?.title}
    </p>
  );

  const detailHref = clubSlug ? `/${clubSlug}/events/${occurrence.id}` : null;

  const infoContent = (
    <>
      {/* Row 1: Title + arrow */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">{titleContent}</div>
        {detailHref && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>

      {/* Row 2: Location/time info + RSVP badge */}
      <div className="mt-1.5 flex items-center gap-2">
        {isMatch && (
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground">
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
        {rsvpBadge}
      </div>

      {occurrence.cancelled && (
        <span className="mt-1.5 inline-block bg-destructive text-white px-2 py-0.5 text-[10px] font-bold uppercase">
          Abgesagt
        </span>
      )}

      {!isMatch && event?.description && (
        <p className="mt-1.5 text-xs text-muted-foreground">{event.description}</p>
      )}

      {location && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-cerulean">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{location}</span>
        </p>
      )}
    </>
  );

  return (
    <div className={cn("overflow-hidden", occurrence.cancelled && "opacity-50")}>
      <div className="flex">
        {detailHref ? (
          <Link href={detailHref} className="flex">{dateBlock}</Link>
        ) : (
          dateBlock
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Clickable area: rows 1+2 */}
          {detailHref ? (
            <Link href={detailHref} className="flex-1 pl-4">
              {infoContent}
            </Link>
          ) : (
            <div className="flex-1 pl-4">{infoContent}</div>
          )}

          {/* Row 3: RSVP buttons (not inside link) */}
          {showRsvp && !occurrence.cancelled && (
            <div className="mt-auto pl-4 pt-4">
              <RsvpButtons occurrenceId={occurrence.id} currentResponse={myResponse} onChange={setOptimisticResponse} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

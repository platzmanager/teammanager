"use client";

import type { EventOccurrence, EventResponse } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { ChevronRight, Globe, Home, MapPin } from "lucide-react";
import Link from "next/link";
import { RsvpButtons } from "./rsvp-buttons";
import { cn } from "@/lib/utils";

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

function getDateBlockColor(isMatch: boolean, isHome?: boolean): string {
  if (!isMatch) return "bg-cerulean";
  return isHome ? "bg-verdigris" : "bg-cerulean";
}

export function EventCard({ occurrence, myResponse, showRsvp = true, clubSlug }: EventCardProps) {
  const event = occurrence.event;
  const match = occurrence.match;
  const isMatch = event?.event_type === "match" && match;
  const countdown = getCountdown(occurrence.start_date);
  const time = formatTime(occurrence.start_time);

  const opponent = isMatch ? (match.is_home ? match.away_team : match.home_team) : null;
  const location = isMatch ? match.location : event?.location;
  const dateColor = getDateBlockColor(!!isMatch, isMatch ? match.is_home : undefined);

  const dateBlock = (
    <div className={cn("flex w-20 shrink-0 flex-col items-center justify-center py-4 text-white", dateColor)}>
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

  const infoBlock = (
    <div className="flex-1 px-4 pb-3">
      {isMatch ? (
        <p className="text-lg font-bold leading-tight text-foreground">
          {opponent}
        </p>
      ) : (
        <p className="text-lg font-bold leading-tight text-foreground">
          {event?.title}
        </p>
      )}

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

      {location && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-cerulean">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{location}</span>
        </p>
      )}
    </div>
  );

  return (
    <div className={cn("overflow-hidden", occurrence.cancelled && "opacity-50")}>
      <div className="flex">
        {dateBlock}
        <div className="flex-1 min-w-0 flex flex-col">
          {clubSlug ? (
            <Link href={`/${clubSlug}/events/${occurrence.id}`} className="flex hover:bg-muted/50 transition-colors">
              <div className="flex-1 min-w-0">{infoBlock}</div>
              <ChevronRight className="h-5 w-5 shrink-0 mr-3 text-muted-foreground" />
            </Link>
          ) : (
            infoBlock
          )}

          {showRsvp && !occurrence.cancelled && (
            <div className="mt-auto">
              <RsvpButtons occurrenceId={occurrence.id} currentResponse={myResponse} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

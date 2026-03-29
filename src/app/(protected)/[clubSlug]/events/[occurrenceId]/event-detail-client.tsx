"use client";

import { ArrowLeft, Check, Clock as ClockIcon, Globe, HelpCircle, Home, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { RsvpButtons } from "@/components/rsvp-buttons";
import type { EventOccurrence, EventResponse, RsvpResponse } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TeamMemberWithSort {
  id: string;
  first_name: string;
  last_name: string;
  player_uuid: string | null;
  sortIndex: number;
}

interface EventDetailClientProps {
  occurrence: EventOccurrence;
  myResponse: EventResponse | null;
  teamMembers?: TeamMemberWithSort[];
}

function formatFullDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
  return t.slice(0, 5) + " Uhr";
}

function getCountdown(iso: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return null;
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays <= 14) return `in ${diffDays} Tagen`;
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

function groupResponsesByStatus(responses: EventResponse[]) {
  const groups: Record<RsvpResponse, EventResponse[]> = { yes: [], maybe: [], no: [] };
  for (const r of responses) {
    if (r.response in groups) {
      groups[r.response].push(r);
    }
  }
  return groups;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const RESPONSE_CONFIG: Record<RsvpResponse, { label: string; icon: typeof Check; color: string; bg: string }> = {
  yes: { label: "Zusagen", icon: Check, color: "text-verdigris", bg: "bg-verdigris" },
  maybe: { label: "Vielleicht", icon: HelpCircle, color: "text-golden", bg: "bg-golden" },
  no: { label: "Absagen", icon: X, color: "text-destructive", bg: "bg-destructive" },
};

export function EventDetailClient({ occurrence, myResponse, teamMembers = [] }: EventDetailClientProps) {
  const router = useRouter();
  const event = occurrence.event;
  const match = occurrence.match;
  const isMatch = event?.event_type === "match" && match;
  const countdown = getCountdown(occurrence.start_date);
  const time = formatTime(occurrence.start_time);
  const opponent = isMatch ? (match.is_home ? match.away_team : match.home_team) : null;
  const location = isMatch ? match.location : event?.location;
  const responses = (occurrence.responses ?? []) as EventResponse[];
  const grouped = groupResponsesByStatus(responses);
  const teamName = event?.team?.name;
  const currentResponse = myResponse?.response ?? null;

  // Build a sort map from teamMembers for ordering responses
  const memberSortMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tm of teamMembers) {
      map.set(tm.id, tm.sortIndex);
    }
    return map;
  }, [teamMembers]);

  // Sort responses within each group by Meldeliste position
  const sortedGrouped = useMemo(() => {
    const result: Record<RsvpResponse, EventResponse[]> = { yes: [], maybe: [], no: [] };
    for (const status of ["yes", "maybe", "no"] as RsvpResponse[]) {
      result[status] = [...grouped[status]].sort((a, b) => {
        const aSort = memberSortMap.get(a.member_id) ?? 9999;
        const bSort = memberSortMap.get(b.member_id) ?? 9999;
        return aSort - bSort;
      });
    }
    return result;
  }, [grouped, memberSortMap]);

  // Find team members who haven't responded
  const nonResponders = useMemo(() => {
    const respondedMemberIds = new Set(responses.map((r) => r.member_id));
    return teamMembers.filter((tm) => !respondedMemberIds.has(tm.id));
  }, [teamMembers, responses]);

  // RSVP badge
  const rsvpBadge = currentResponse ? (() => {
    const RsvpIcon = currentResponse === "yes" ? Check : currentResponse === "no" ? X : HelpCircle;
    const rsvpColor = currentResponse === "yes" ? "bg-verdigris/15 text-verdigris" : currentResponse === "maybe" ? "bg-golden/15 text-golden" : "bg-destructive/15 text-destructive";
    const rsvpLabel = currentResponse === "yes" ? "Dabei" : currentResponse === "maybe" ? "Unsicher" : "Nicht dabei";
    return (
      <span className={cn("flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase shrink-0", rsvpColor)}>
        <RsvpIcon className="h-3.5 w-3.5" />
        {rsvpLabel}
      </span>
    );
  })() : null;

  // Hero accent colors based on home/away
  const heroAccent = isMatch
    ? match.is_home
      ? { border: "border-l-verdigris", bg: "bg-verdigris/5" }
      : { border: "border-l-cerulean", bg: "bg-cerulean/5" }
    : { border: "border-l-sage", bg: "bg-sage/5" };

  return (
    <div>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </button>

      {/* Hero Header */}
      <div className={cn("border-l-4 -mx-4 px-4 py-5", heroAccent.border, heroAccent.bg)}>
        {teamName && (
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{teamName}</p>
        )}

        {isMatch ? (
          <>
            <h1 className="font-display text-3xl">{opponent}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-sm font-bold uppercase text-muted-foreground">
                {match.is_home ? <Home className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {match.is_home ? "Heimspiel" : "Auswärtsspiel"}
              </span>
              {countdown && (
                <span className={cn("px-2 py-0.5 text-xs font-bold uppercase", getCountdownColor(countdown))}>
                  {countdown}
                </span>
              )}
              {rsvpBadge}
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl">{event?.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold uppercase text-sage">
                {event && EVENT_TYPE_LABELS[event.event_type]}
              </span>
              {countdown && (
                <span className={cn("px-2 py-0.5 text-xs font-bold uppercase", getCountdownColor(countdown))}>
                  {countdown}
                </span>
              )}
              {rsvpBadge}
            </div>
          </>
        )}

        {occurrence.cancelled && (
          <span className="mt-3 inline-block bg-destructive text-white px-2 py-0.5 text-xs font-bold uppercase">
            Abgesagt
          </span>
        )}
      </div>

      {/* Date/Time/Location Block */}
      <div className="mt-6 flex border border-border overflow-hidden">
        <div className={cn("flex w-20 shrink-0 flex-col items-center justify-center py-3 text-white", getDateBlockColor(currentResponse))}>
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
        <div className="flex-1 flex flex-col justify-center gap-1 px-4 py-3">
          <span className="text-sm text-muted-foreground">{formatFullDate(occurrence.start_date)}</span>
          {time && (
            <span className="text-lg font-bold">{time}</span>
          )}
          {location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-cerulean hover:text-cerulean/70 transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="underline-offset-2 hover:underline">{location}</span>
            </a>
          )}
        </div>
      </div>

      {/* Description (non-match events) */}
      {!isMatch && event?.description && (
        <p className="mt-4 text-sm text-muted-foreground">{event.description}</p>
      )}

      {/* Two-column layout on desktop: RSVP left, Participants right */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: RSVP + Summary */}
        <div>
          {/* RSVP Buttons */}
          {!occurrence.cancelled && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Rückmeldung</h2>
              <RsvpButtons occurrenceId={occurrence.id} currentResponse={myResponse} />
            </div>
          )}

          {/* RSVP Summary Bar */}
          {responses.length > 0 && (
            <RsvpSummaryBar grouped={grouped} />
          )}
        </div>

        {/* Right column: Participants */}
        {(responses.length > 0 || nonResponders.length > 0) && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 lg:hidden">Teilnehmer</h2>

            <div className="space-y-3">
              {(["yes", "maybe", "no"] as RsvpResponse[]).map((status) => {
                const items = sortedGrouped[status];
                if (items.length === 0) return null;
                const config = RESPONSE_CONFIG[status];
                const Icon = config.icon;

                return (
                  <div key={status} className="border border-border">
                    {/* Group header */}
                    <div className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b border-border bg-muted/30", config.color)}>
                      <Icon className="h-4 w-4" />
                      <span>{config.label} ({items.length})</span>
                    </div>
                    {/* Members */}
                    {items.map((r, i) => (
                      <div key={r.id} className={cn("flex items-center gap-3 px-4 py-2.5", i < items.length - 1 && "border-b border-border")}>
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold text-white", config.bg)}>
                          {getInitials(r.member?.first_name ?? "", r.member?.last_name ?? "")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm">{r.member?.first_name} {r.member?.last_name}</span>
                          {r.comment && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{r.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Non-responders */}
              {nonResponders.length > 0 && (
                <div className="border border-border">
                  <div className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold border-b border-border bg-muted/30 text-muted-foreground">
                    <ClockIcon className="h-4 w-4" />
                    <span>Ausstehend ({nonResponders.length})</span>
                  </div>
                  {nonResponders.map((m, i) => (
                    <div key={m.id} className={cn("flex items-center gap-3 px-4 py-2.5 text-muted-foreground", i < nonResponders.length - 1 && "border-b border-border")}>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold bg-muted text-muted-foreground">
                        {getInitials(m.first_name, m.last_name)}
                      </div>
                      <span className="text-sm">{m.first_name} {m.last_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RsvpSummaryBar({ grouped }: { grouped: Record<RsvpResponse, EventResponse[]> }) {
  const yes = grouped.yes.length;
  const maybe = grouped.maybe.length;
  const no = grouped.no.length;
  const total = yes + maybe + no;

  if (total === 0) return null;

  const yesPct = (yes / total) * 100;
  const maybePct = (maybe / total) * 100;
  const noPct = (no / total) * 100;

  return (
    <div className="mt-4">
      <div className="flex h-2 w-full overflow-hidden bg-muted">
        {yes > 0 && <div className="bg-verdigris transition-all" style={{ width: `${yesPct}%` }} />}
        {maybe > 0 && <div className="bg-golden transition-all" style={{ width: `${maybePct}%` }} />}
        {no > 0 && <div className="bg-destructive transition-all" style={{ width: `${noPct}%` }} />}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        {yes > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-verdigris shrink-0" />
            {yes} Zusagen
          </span>
        )}
        {maybe > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-golden shrink-0" />
            {maybe} Vielleicht
          </span>
        )}
        {no > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 bg-destructive shrink-0" />
            {no} Absagen
          </span>
        )}
      </div>
    </div>
  );
}

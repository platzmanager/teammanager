"use client";

import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import type { EventOccurrence, EventResponse, RsvpResponse } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Home, MapPin, Globe, Check, HelpCircle, X, ArrowLeft, Calendar, Clock } from "lucide-react";
import { RsvpButtons } from "@/components/rsvp-buttons";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface EventDetailClientProps {
  occurrence: EventOccurrence;
  myResponse: EventResponse | null;
}

function formatFullDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function groupResponsesByStatus(responses: EventResponse[]) {
  const groups: Record<RsvpResponse, EventResponse[]> = { yes: [], maybe: [], no: [] };
  for (const r of responses) {
    if (r.response in groups) {
      groups[r.response].push(r);
    }
  }
  return groups;
}

const RESPONSE_CONFIG: Record<RsvpResponse, { label: string; icon: typeof Check; color: string }> = {
  yes: { label: "Zusagen", icon: Check, color: "text-verdigris" },
  maybe: { label: "Vielleicht", icon: HelpCircle, color: "text-golden" },
  no: { label: "Absagen", icon: X, color: "text-destructive" },
};

export function EventDetailClient({ occurrence, myResponse }: EventDetailClientProps) {
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

  const rsvpBadge = currentResponse ? (() => {
    const RsvpIcon = currentResponse === "yes" ? Check : currentResponse === "no" ? X : null;
    const rsvpColor = currentResponse === "yes" ? "bg-verdigris/15 text-verdigris" : currentResponse === "maybe" ? "bg-golden/15 text-golden" : "bg-destructive/15 text-destructive";
    const rsvpLabel = currentResponse === "yes" ? "Dabei" : currentResponse === "maybe" ? "Unsicher" : "Nicht dabei";
    return (
      <span className={cn("ml-auto flex items-center gap-1 px-1.5 text-xs font-bold uppercase shrink-0", rsvpColor)}>
        {RsvpIcon ? <RsvpIcon className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">?</span>}
        {rsvpLabel}
      </span>
    );
  })() : null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </button>

      {/* Team context */}
      {teamName && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{teamName}</p>
      )}

      {/* Header */}
      <div>
        {isMatch ? (
          <>
            <h1 className="text-2xl font-bold">{opponent}</h1>
            <div className="mt-2 flex items-center gap-2">
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
            <h1 className="text-2xl font-bold">{event?.title}</h1>
            <div className="mt-2 flex items-center gap-2">
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
          <span className="mt-2 inline-block bg-destructive text-white px-2 py-0.5 text-xs font-bold uppercase">
            Abgesagt
          </span>
        )}
      </div>

      {/* Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatFullDate(occurrence.start_date)}</span>
        </div>
        {time && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{time}</span>
          </div>
        )}
        {location && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-cerulean hover:text-cerulean/70 transition-colors"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="underline-offset-2 hover:underline">{location}</span>
          </a>
        )}
        {!isMatch && event?.description && (
          <p className="text-sm text-muted-foreground">{event.description}</p>
        )}
      </div>

      {/* RSVP */}
      {!occurrence.cancelled && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Rückmeldung</h2>
          <div className="max-w-sm">
            <RsvpButtons occurrenceId={occurrence.id} currentResponse={myResponse} />
          </div>
        </div>
      )}

      {/* RSVP Chart */}
      {responses.length > 0 && <RsvpChart grouped={grouped} />}

      {/* Responses list */}
      {responses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Teilnehmer</h2>
          {(["yes", "maybe", "no"] as RsvpResponse[]).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            const config = RESPONSE_CONFIG[status];
            const Icon = config.icon;

            return (
              <div key={status}>
                <div className={cn("flex items-center gap-1.5 text-sm font-bold mb-2", config.color)}>
                  <Icon className="h-4 w-4" />
                  <span>{config.label} ({items.length})</span>
                </div>
                <div className="space-y-1 pl-6">
                  {items.map((r) => (
                    <div key={r.id} className="text-sm">
                      <span>{r.member?.first_name} {r.member?.last_name}</span>
                      {r.comment && (
                        <span className="text-muted-foreground ml-2">– {r.comment}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const rsvpChartConfig = {
  count: { label: "Antworten" },
  yes: { label: "Dabei", color: "var(--color-verdigris)" },
  maybe: { label: "Unsicher", color: "var(--color-golden)" },
  no: { label: "Nicht dabei", color: "var(--color-destructive)" },
} satisfies ChartConfig;

function RsvpChart({ grouped }: { grouped: Record<RsvpResponse, EventResponse[]> }) {
  const chartData = useMemo(() => [
    { status: "yes", count: grouped.yes.length, fill: "var(--color-yes)" },
    { status: "maybe", count: grouped.maybe.length, fill: "var(--color-maybe)" },
    { status: "no", count: grouped.no.length, fill: "var(--color-no)" },
  ].filter((d) => d.count > 0), [grouped]);

  const total = useMemo(() => chartData.reduce((acc, d) => acc + d.count, 0), [chartData]);

  if (total === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Übersicht</h2>
      <ChartContainer config={rsvpChartConfig} className="mx-auto aspect-square max-h-[250px]">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="status"
            innerRadius={45}
            outerRadius={70}
            strokeWidth={3}
            label={({
              cx,
              cy,
              midAngle,
              outerRadius,
              payload,
            }: {
              cx: number;
              cy: number;
              midAngle: number;
              outerRadius: number;
              payload: { status: string; count: number };
            }) => {
              const RADIAN = Math.PI / 180;
              const radius = outerRadius + 20;
              const x = cx + radius * Math.cos(-midAngle * RADIAN);
              const y = cy + radius * Math.sin(-midAngle * RADIAN);
              const ex = cx + (outerRadius + 6) * Math.cos(-midAngle * RADIAN);
              const ey = cy + (outerRadius + 6) * Math.sin(-midAngle * RADIAN);
              return (
                <g>
                  <line x1={ex} y1={ey} x2={x} y2={y} stroke="var(--color-muted-foreground)" strokeWidth={1} />
                  <text
                    x={x}
                    y={y}
                    textAnchor={x > cx ? "start" : "end"}
                    dominantBaseline="central"
                    className="fill-foreground text-xs font-medium"
                    dx={x > cx ? 4 : -4}
                  >
                    {payload.count}
                  </text>
                </g>
              );
            }}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 10} className="fill-foreground text-2xl font-bold">
                        {total}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 10} className="fill-muted-foreground text-xs">
                        Antworten
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
    </div>
  );
}

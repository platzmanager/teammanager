"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventOccurrence, EventResponse, EVENT_TYPE_LABELS } from "@/lib/types";

interface CalendarViewProps {
  occurrences: EventOccurrence[];
  myResponses?: Record<string, EventResponse>;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-based: 0=Mon, 6=Sun
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function CalendarView({ occurrences, myResponses = {} }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = getMonthDays(year, month);
  const monthLabel = new Date(year, month).toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  // Index occurrences by date
  const byDate: Record<string, EventOccurrence[]> = {};
  for (const occ of occurrences) {
    if (!byDate[occ.start_date]) byDate[occ.start_date] = [];
    byDate[occ.start_date].push(occ);
  }

  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const selectedOccurrences = selectedDate ? (byDate[selectedDate] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-md border bg-muted overflow-hidden">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="bg-white py-1 text-center text-xs font-medium text-muted-foreground">
            {wd}
          </div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="bg-white" />;
          const dateStr = formatDate(year, month, day);
          const hasEvents = !!byDate[dateStr];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`bg-white py-2 text-center text-sm transition-colors hover:bg-muted/50
                ${isToday ? "font-bold" : ""}
                ${isSelected ? "bg-primary/10 ring-1 ring-primary" : ""}
              `}
            >
              {day}
              {hasEvents && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {byDate[dateStr].slice(0, 3).map((occ) => (
                    <span
                      key={occ.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        occ.event?.event_type === "match" ? "bg-blue-500" :
                        occ.event?.event_type === "training" ? "bg-green-500" :
                        "bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}
          </h4>
          {selectedOccurrences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Termine an diesem Tag.</p>
          ) : (
            <div className="space-y-2">
              {selectedOccurrences.map((occ) => {
                const event = occ.event;
                const match = occ.match;
                const isMatch = event?.event_type === "match" && match;
                return (
                  <div key={occ.id} className="rounded-md border bg-white px-3 py-2 text-sm">
                    {isMatch ? (
                      <div>
                        <span className="font-medium">{match.home_team} – {match.away_team}</span>
                        {occ.start_time && <span className="ml-2 text-muted-foreground">{occ.start_time.slice(0, 5)} Uhr</span>}
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">{event?.title}</span>
                        {event && <span className="ml-2 text-xs text-muted-foreground">{EVENT_TYPE_LABELS[event.event_type]}</span>}
                        {occ.start_time && <span className="ml-2 text-muted-foreground">{occ.start_time.slice(0, 5)} Uhr</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { EventOccurrence, EventResponse } from "@/lib/types";
import { EventList } from "@/components/event-list";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface EventsClientProps {
  occurrences: EventOccurrence[];
  myResponses: Record<string, EventResponse>;
  isAdminOrCaptain: boolean;
  clubSlug: string;
  teamIds: string[];
}

export function EventsClient({ occurrences, myResponses, isAdminOrCaptain, clubSlug, teamIds }: EventsClientProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Termine</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${clubSlug}/events/calendar`}>Kalender</Link>
          </Button>
          {isAdminOrCaptain && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Neuer Termin
            </Button>
          )}
        </div>
      </div>

      <EventList occurrences={occurrences} myResponses={myResponses} />

      {isAdminOrCaptain && (
        <EventForm open={formOpen} onOpenChange={setFormOpen} teamId={teamIds[0] ?? null} />
      )}
    </div>
  );
}

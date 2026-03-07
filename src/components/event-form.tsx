"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_TYPE_LABELS, RECURRENCE_TYPE_LABELS, EventType, RecurrenceType } from "@/lib/types";
import { createEvent } from "@/actions/events";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string | null;
}

export function EventForm({ open, onOpenChange, teamId }: EventFormProps) {
  const [isPending, startTransition] = useTransition();
  const [eventType, setEventType] = useState<EventType>("training");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (teamId) formData.set("team_id", teamId);
    formData.set("event_type", eventType);
    formData.set("recurrence_type", recurrenceType);

    startTransition(async () => {
      try {
        await createEvent(formData);
        toast.success("Termin erstellt");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Termin</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" name="title" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Ort</Label>
            <Input id="location" name="location" />
          </div>

          <div className="space-y-2">
            <Label>Art</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(EVENT_TYPE_LABELS) as [EventType, string][])
                  .filter(([k]) => k !== "match")
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Datum</Label>
              <Input id="start_date" name="start_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_time">Von</Label>
              <Input id="start_time" name="start_time" type="time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Bis</Label>
              <Input id="end_time" name="end_time" type="time" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Wiederholung</Label>
            <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as RecurrenceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recurrenceType !== "none" && (
            <div className="space-y-2">
              <Label htmlFor="recurrence_end_date">Wiederholung bis</Label>
              <Input id="recurrence_end_date" name="recurrence_end_date" type="date" />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Termin erstellen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Team } from "@/lib/types";
import { createTeam, updateTeam } from "@/actions/teams";

interface TeamFormProps {
  team?: Team;
  trigger?: React.ReactNode;
  onDone?: () => void;
}

export function TeamForm({ team, trigger, onDone }: TeamFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!team;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (team) formData.set("id", team.id);

    try {
      if (isEdit) {
        await updateTeam(formData);
      } else {
        await createTeam(formData);
      }
      setOpen(false);
      onDone?.();
    } catch {
      alert("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Team hinzufügen</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Team bearbeiten" : "Team hinzufügen"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={team?.name}
              placeholder="z.B. Herren 30 I"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender">Geschlecht</Label>
              <select
                id="gender"
                name="gender"
                defaultValue={team?.gender ?? "male"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="male">Herren</option>
                <option value="female">Damen</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="age_class">Altersklasse</Label>
              <select
                id="age_class"
                name="age_class"
                defaultValue={team?.age_class ?? "offen"}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="offen">Offen</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="50">50</option>
                <option value="60">60</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Speichern..." : "Speichern"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

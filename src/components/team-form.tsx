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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [gender, setGender] = useState(team?.gender ?? "male");
  const [ageClass, setAgeClass] = useState(team?.age_class ?? "offen");
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
              <input type="hidden" name="gender" value={gender} />
              <Select value={gender} onValueChange={v => setGender(v as "male" | "female")}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Herren</SelectItem>
                  <SelectItem value="female">Damen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="age_class">Altersklasse</Label>
              <input type="hidden" name="age_class" value={ageClass} />
              <Select value={ageClass} onValueChange={v => setAgeClass(v as typeof ageClass)}>
                <SelectTrigger id="age_class" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="40">40</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                </SelectContent>
              </Select>
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

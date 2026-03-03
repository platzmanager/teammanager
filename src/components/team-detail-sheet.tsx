"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Team } from "@/lib/types";
import { updateTeam, deleteTeam } from "@/actions/teams";

interface TeamDetailSheetProps {
  team: Team;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubSlug: string;
}

export function TeamDetailSheet({ team, open, onOpenChange, clubSlug }: TeamDetailSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState(team.gender);
  const [ageClass, setAgeClass] = useState(team.age_class);
  const [teamSize, setTeamSize] = useState(String(team.team_size));
  const [rank, setRank] = useState(String(team.rank));

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("id", team.id);
    try {
      await updateTeam(formData);
      onOpenChange(false);
      router.refresh();
    } catch {
      alert("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Team "${team.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    setLoading(true);
    try {
      await deleteTeam(team.id);
      router.push(`/${clubSlug}/teams`);
    } catch {
      alert("Fehler beim Löschen");
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Team bearbeiten</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col justify-between px-6 pb-6">
          <form action={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sheet-gender">Geschlecht</Label>
                <input type="hidden" name="gender" value={gender} />
                <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                  <SelectTrigger id="sheet-gender" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Herren</SelectItem>
                    <SelectItem value="female">Damen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-age-class">Altersklasse</Label>
                <input type="hidden" name="age_class" value={ageClass} />
                <Select value={ageClass} onValueChange={(v) => setAgeClass(v as typeof ageClass)}>
                  <SelectTrigger id="sheet-age-class" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="40">40</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sheet-team-size">Mannschaftsstärke</Label>
                <input type="hidden" name="team_size" value={teamSize} />
                <Select value={teamSize} onValueChange={setTeamSize}>
                  <SelectTrigger id="sheet-team-size" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6er-Mannschaft</SelectItem>
                    <SelectItem value="4">4er-Mannschaft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-rank">Mannschaftsnummer</Label>
                <input type="hidden" name="rank" value={rank} />
                <Input
                  id="sheet-rank"
                  type="number"
                  min={1}
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sheet-name">Name</Label>
              <Input
                id="sheet-name"
                name="name"
                defaultValue={team.name}
                placeholder="z.B. Herren 30 I"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Speichern..." : "Speichern"}
            </Button>
          </form>

          <div className="mt-auto pt-8">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <h4 className="text-sm font-medium text-destructive">Gefahrenzone</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Das Löschen eines Teams kann nicht rückgängig gemacht werden.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3 w-full"
                onClick={handleDelete}
                disabled={loading}
              >
                Team löschen
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

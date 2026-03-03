"use client";

import { useState, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Team, Gender, AgeClass, GENDER_LABELS } from "@/lib/types";
import { createTeam, updateTeam, getNextRank } from "@/actions/teams";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function buildName(gender: string, ageClass: string, rank: number): string {
  const genderLabel = GENDER_LABELS[gender as keyof typeof GENDER_LABELS] ?? gender;
  const numeral = ROMAN[rank - 1] ?? String(rank);
  const base = ageClass === "all" ? genderLabel : `${genderLabel} ${ageClass}`;
  return `${base} ${numeral}`;
}

interface TeamFormProps {
  team?: Team;
  trigger?: React.ReactNode;
  onDone?: () => void;
}

export function TeamForm({ team, trigger, onDone }: TeamFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState(team?.gender ?? "male");
  const [ageClass, setAgeClass] = useState(team?.age_class ?? "all");
  const [teamSize, setTeamSize] = useState(String(team?.team_size ?? 6));
  const isEdit = !!team;
  const [name, setName] = useState(team?.name ?? "");
  const nameManuallyEdited = useRef(isEdit);
  const [nextRank, setNextRank] = useState(1);

  const fetchAndSetName = useCallback(async (g: string, ac: string) => {
    const rank = await getNextRank(g as Gender, ac as AgeClass);
    setNextRank(rank);
    setName(buildName(g, ac, rank));
  }, []);

  function handleGenderChange(v: string) {
    setGender(v as "male" | "female");
    if (!nameManuallyEdited.current) fetchAndSetName(v, ageClass);
  }

  function handleAgeClassChange(v: string) {
    setAgeClass(v as typeof ageClass);
    if (!nameManuallyEdited.current) fetchAndSetName(gender, v);
  }

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !isEdit) {
      nameManuallyEdited.current = false;
      setGender("male");
      setAgeClass("all");
      setTeamSize("6");
      // Set a placeholder name synchronously, then refine with rank
      setName(buildName("male", "all", 1));
      getNextRank("male" as Gender, "all" as AgeClass).then((rank) => {
        setNextRank(rank);
        if (!nameManuallyEdited.current) setName(buildName("male", "all", rank));
      });
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
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
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        {trigger || <Button size="sm">Team hinzufügen</Button>}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>
            {isEdit ? "Team bearbeiten" : "Team hinzufügen"}
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="gender">Geschlecht</Label>
                <input type="hidden" name="gender" value={gender} />
                <Select value={gender} onValueChange={handleGenderChange}>
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Herren</SelectItem>
                    <SelectItem value="female">Damen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age_class">Altersklasse</Label>
                <input type="hidden" name="age_class" value={ageClass} />
                <Select value={ageClass} onValueChange={handleAgeClassChange}>
                  <SelectTrigger id="age_class" className="w-full">
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
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={e => { setName(e.target.value); nameManuallyEdited.current = true; }}
                placeholder="z.B. Herren 30 I"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team_size">Mannschaftsstärke</Label>
              <input type="hidden" name="team_size" value={teamSize} />
              <Select value={teamSize} onValueChange={setTeamSize}>
                <SelectTrigger id="team_size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6er-Mannschaft</SelectItem>
                  <SelectItem value="4">4er-Mannschaft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Speichern..." : "Speichern"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

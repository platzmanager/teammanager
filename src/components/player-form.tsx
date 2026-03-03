"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Player, Gender, AgeClass } from "@/lib/types";
import { createPlayer, updatePlayer } from "@/actions/players";

interface PlayerFormProps {
  gender: Gender;
  ageClass?: AgeClass;
  player?: Player;
  trigger?: React.ReactNode;
  onDone?: () => void;
  isAdmin?: boolean;
}

export function PlayerForm({ gender, ageClass, player, trigger, onDone, isAdmin = false }: PlayerFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedGender, setSelectedGender] = useState<Gender>(player?.gender ?? gender);
  const [birthDate, setBirthDate] = useState(player?.birth_date ?? "");
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const isEdit = !!player;

  function validateBirthDate(date: string) {
    if (!date || !ageClass || ageClass === "all") {
      setBirthDateError(null);
      return true;
    }
    const birthYear = new Date(date).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    const minAge = parseInt(ageClass, 10);
    if (age < minAge) {
      setBirthDateError(`Altersklasse ${ageClass} erfordert ein Mindestalter von ${minAge} Jahren (aktuell ${age})`);
      return false;
    }
    setBirthDateError(null);
    return true;
  }

  async function handleSubmit(formData: FormData) {
    const bd = formData.get("birth_date") as string;
    if (!validateBirthDate(bd)) return;
    setLoading(true);
    formData.set("gender", isAdmin ? selectedGender : gender);
    if (player) formData.set("uuid", player.uuid);

    try {
      if (isEdit) {
        await updatePlayer(formData);
      } else {
        await createPlayer(formData);
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || <Button size="sm">Spieler hinzufügen</Button>}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>
            {isEdit ? "Spieler bearbeiten" : "Spieler hinzufügen"}
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <form action={handleSubmit} className="space-y-5">
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="pf-gender">Geschlecht</Label>
                <Select value={selectedGender} onValueChange={(v) => setSelectedGender(v as Gender)}>
                  <SelectTrigger id="pf-gender" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Herren</SelectItem>
                    <SelectItem value="female">Damen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-first_name">Vorname</Label>
                <Input
                  id="pf-first_name"
                  name="first_name"
                  defaultValue={player?.first_name}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-last_name">Nachname</Label>
                <Input
                  id="pf-last_name"
                  name="last_name"
                  defaultValue={player?.last_name}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-birth_date">Geburtsdatum</Label>
                <Input
                  id="pf-birth_date"
                  name="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    validateBirthDate(e.target.value);
                  }}
                  required
                />
                {birthDateError && (
                  <p className="text-xs text-destructive">{birthDateError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-skill_level">LK (1-25)</Label>
                <Input
                  id="pf-skill_level"
                  name="skill_level"
                  type="number"
                  min={1}
                  max={25}
                  step={0.1}
                  defaultValue={player?.skill_level ?? undefined}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-license">Spiellizenz (optional)</Label>
              <Input
                id="pf-license"
                name="license"
                defaultValue={player?.license ?? ""}
                inputMode="numeric"
                pattern="[0-9]*"
                onKeyDown={(e) => {
                  if (!/[0-9]/.test(e.key) && !["Backspace","Delete","Tab","ArrowLeft","ArrowRight","Home","End"].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-notes">Bemerkung (optional)</Label>
              <Textarea
                id="pf-notes"
                name="notes"
                rows={2}
                defaultValue={player?.notes ?? ""}
                placeholder="z.B. Verletzung, Verfügbarkeit..."
              />
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

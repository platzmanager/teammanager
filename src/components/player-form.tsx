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
import { Textarea } from "@/components/ui/textarea";
import { Player, Gender } from "@/lib/types";
import { createPlayer, updatePlayer } from "@/actions/players";

interface PlayerFormProps {
  gender: Gender;
  player?: Player;
  trigger?: React.ReactNode;
  onDone?: () => void;
}

export function PlayerForm({ gender, player, trigger, onDone }: PlayerFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!player;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("gender", gender);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Spieler hinzufügen</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Spieler bearbeiten" : "Spieler hinzufügen"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Vorname</Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={player?.first_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Nachname</Label>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={player?.last_name}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Geburtsdatum</Label>
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                defaultValue={player?.birth_date}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill_level">LK (1-25)</Label>
              <Input
                id="skill_level"
                name="skill_level"
                type="number"
                min={1}
                max={25}
                step={0.1}
                defaultValue={player?.skill_level ?? undefined}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="license">Spiellizenz (optional)</Label>
            <Input
              id="license"
              name="license"
              defaultValue={player?.license ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Bemerkung (optional)</Label>
            <Textarea
              id="notes"
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
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { updateProfile } from "@/actions/profile";

interface ProfileFormProps {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
}

export function ProfileForm({ email, firstName: initialFirst, lastName: initialLast, birthDate: initialBirth }: ProfileFormProps) {
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [birthDate, setBirthDate] = useState(initialBirth);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfile({
          first_name: firstName,
          last_name: lastName,
          birth_date: birthDate,
        });
        toast.success("Profil gespeichert");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">E-Mail</label>
        <Input id="email" type="email" value={email} disabled className="bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="first_name" className="text-sm font-medium">Vorname</label>
          <Input
            id="first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="last_name" className="text-sm font-medium">Nachname</label>
          <Input
            id="last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="birth_date" className="text-sm font-medium">Geburtsdatum</label>
        <Input
          id="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </form>
  );
}

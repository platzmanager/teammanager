"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Team } from "@/lib/types";
import { getTeams, deleteTeam } from "@/actions/teams";
import { TeamForm } from "@/components/team-form";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);

  const refresh = async () => {
    const data = await getTeams();
    setTeams(data);
  };

  useEffect(() => {
    let cancelled = false;
    getTeams().then((data) => {
      if (!cancelled) setTeams(data);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Team "${name}" wirklich löschen?`)) return;
    await deleteTeam(id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Teams</h2>
        <TeamForm onDone={refresh} />
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Geschlecht</TableHead>
              <TableHead>Altersklasse</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Keine Teams vorhanden
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.gender === "male" ? "Herren" : "Damen"}</TableCell>
                  <TableCell>{team.age_class === "offen" ? "Offen" : team.age_class}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <TeamForm
                        team={team}
                        onDone={refresh}
                        trigger={
                          <Button variant="ghost" size="sm">
                            ✎
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(team.id, team.name)}
                      >
                        ✕
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

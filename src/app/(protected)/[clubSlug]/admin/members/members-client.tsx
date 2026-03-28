"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Users, UserPlus, Link2, Upload } from "lucide-react";
import { linkUserToMember } from "@/actions/members";
import { toast } from "sonner";
import { Member } from "@/lib/types";
import Link from "next/link";

interface MemberWithTeams extends Member {
  teams: { team: { id: string; name: string } }[];
}

interface UnlinkedUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  role: string;
}

export function MembersClient({
  members: initialMembers,
  unmatchedCount,
  unlinkedUsers: initialUnlinked,
  clubSlug,
}: {
  members: MemberWithTeams[];
  unmatchedCount: number;
  unlinkedUsers: UnlinkedUser[];
  clubSlug: string;
}) {
  const [members] = useState(initialMembers);
  const [unlinkedUsers, setUnlinkedUsers] = useState(initialUnlinked);
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});

  const unlinkedMembers = members.filter((m) => !m.user_id);

  async function handleLink(userId: string) {
    const memberId = linkSelections[userId];
    if (!memberId) return;
    try {
      await linkUserToMember(userId, memberId);
      setUnlinkedUsers((prev) => prev.filter((u) => u.id !== userId));
      setLinkSelections((prev) => { const next = { ...prev }; delete next[userId]; return next; });
      toast.success("User verknüpft");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Verknüpfen");
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats + Import button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <div className="flex items-center gap-2 border px-4 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{members.length} Mitglieder</span>
          </div>
          {unmatchedCount > 0 && (
            <div className="flex items-center gap-2 border border-golden/30 bg-golden/10 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-golden" />
              <span className="text-sm font-medium text-golden">
                {unmatchedCount} ohne Spieler-Verknüpfung
              </span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${clubSlug}/admin/members/import`}>
            <Upload className="mr-2 h-4 w-4" />
            Importieren
          </Link>
        </Button>
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Spieler</TableHead>
                <TableHead>Teams</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.last_name}, {m.first_name}
                    {m.source === "invite" && (
                      <span className="ml-2 bg-golden/10 px-1.5 py-0.5 text-xs text-golden">Selbst registriert</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.email ?? "–"}</TableCell>
                  <TableCell>
                    {m.player_uuid ? (
                      <span className="bg-verdigris/10 px-1.5 py-0.5 text-xs text-verdigris">Verknüpft</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.teams.map((t) => t.team.name).join(", ") || "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Unlinked users */}
      {unlinkedUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-golden" />
            <h3 className="text-lg font-semibold">Nicht verknüpfte User ({unlinkedUsers.length})</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Diese User haben sich registriert, konnten aber keinem Mitglied zugeordnet werden.
          </p>
          <div className="space-y-2">
            {unlinkedUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 border bg-golden/5 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {u.first_name && u.last_name
                      ? `${u.last_name}, ${u.first_name}`
                      : "Kein Name hinterlegt"}
                  </p>
                  {u.birth_date && (
                    <p className="text-xs text-muted-foreground">{u.birth_date}</p>
                  )}
                </div>
                <Select
                  value={linkSelections[u.id] ?? ""}
                  onValueChange={(v) =>
                    setLinkSelections((prev) => ({ ...prev, [u.id]: v }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Mitglied wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.last_name}, {m.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!linkSelections[u.id]}
                  onClick={() => handleLink(u.id)}
                >
                  <Link2 className="mr-1 h-4 w-4" />
                  Verknüpfen
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

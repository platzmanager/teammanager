"use client";

import { useState, useCallback, useRef } from "react";
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
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Users, UserPlus, Link2 } from "lucide-react";
import Papa from "papaparse";
import { importMembers, linkUserToMember } from "@/actions/members";
import { toast } from "sonner";
import { Member } from "@/lib/types";

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

interface ImportResult {
  count: number;
  inserted: number;
  updated: number;
  total: number;
  skipped: { row: number; name: string; reason: string }[];
}

interface ParsedMember {
  external_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
}

export function MembersClient({
  members: initialMembers,
  unmatchedCount,
  unlinkedUsers: initialUnlinked,
}: {
  members: MemberWithTeams[];
  unmatchedCount: number;
  unlinkedUsers: UnlinkedUser[];
}) {
  const [members] = useState(initialMembers);
  const [unlinkedUsers, setUnlinkedUsers] = useState(initialUnlinked);
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ParsedMember[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = Papa.parse<Record<string, string>>(text, {
        delimiter: ";",
        header: true,
        skipEmptyLines: true,
      });

      const mapped: ParsedMember[] = parsed.data.map((r) => ({
        external_id: r["Mitgliedsnummer"] ?? r["Nr."] ?? r["external_id"] ?? r["ID"] ?? "",
        first_name: r["Vorname"] ?? r["first_name"] ?? "",
        last_name: r["Nachname"] ?? r["last_name"] ?? "",
        birth_date: r["Geburtsdatum"] ?? r["birth_date"] ?? "",
        email: r["E-Mail"] ?? r["Email"] ?? r["email"] ?? "",
      }));

      setRows(mapped);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const clearFile = () => {
    setRows([]);
    setFileName(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const res = await importMembers(rows);
      setResult(res);
      setRows([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  const previewRows = rows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats */}
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

      {/* CSV Import */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Mitglieder importieren</h3>

        {!fileName ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-6 sm:p-10 transition-colors
              ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"}
            `}
          >
            <div className="rounded-full p-3 bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Mitglieder-CSV hierher ziehen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Spalten: Vorname, Nachname, Geburtsdatum, E-Mail
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 border bg-muted/50 px-4 py-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">{rows.length} Mitglieder erkannt</p>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFile} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                Vorschau
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({rows.length} Mitglieder)
                </span>
              </h4>
              <div className="border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr.</TableHead>
                      <TableHead>Vorname</TableHead>
                      <TableHead>Nachname</TableHead>
                      <TableHead>Geburtsdatum</TableHead>
                      <TableHead>E-Mail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        <TableCell className="text-muted-foreground">{row.external_id || "–"}</TableCell>
                        <TableCell>{row.first_name}</TableCell>
                        <TableCell>{row.last_name}</TableCell>
                        <TableCell>{row.birth_date}</TableCell>
                        <TableCell>{row.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  ... und {rows.length - 5} weitere
                </p>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Importiere..." : `${rows.length} Mitglieder importieren`}
            </Button>
          </>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2.5 border bg-verdigris/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-verdigris shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-verdigris">{result.inserted}</p>
                  <p className="text-xs text-verdigris">Neu importiert</p>
                </div>
              </div>
              {result.updated > 0 && (
                <div className="flex items-center gap-2.5 border bg-blue-50 p-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                    <p className="text-xs text-blue-600">Aktualisiert</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2.5 border bg-golden/10 p-3">
                <AlertTriangle className="h-5 w-5 text-golden shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-golden">{result.skipped.length}</p>
                  <p className="text-xs text-golden">Übersprungen</p>
                </div>
              </div>
            </div>

            {result.skipped.length > 0 && (
              <details className="border">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {result.skipped.length} übersprungen
                </summary>
                <div className="border-t px-4 py-2">
                  {result.skipped.map((s, i) => (
                    <p key={i} className="py-0.5 text-sm text-muted-foreground">
                      Zeile {s.row}: {s.name} — {s.reason}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

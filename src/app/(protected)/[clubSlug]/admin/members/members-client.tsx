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
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import Papa from "papaparse";
import { importMembers } from "@/actions/members";
import { Member } from "@/lib/types";

interface MemberWithTeams extends Member {
  teams: { team: { id: string; name: string } }[];
}

interface ImportResult {
  count: number;
  total: number;
  skipped: { row: number; name: string; reason: string }[];
}

interface ParsedMember {
  first_name: string;
  last_name: string;
  birth_date: string;
  email: string;
}

export function MembersClient({
  members: initialMembers,
  unmatchedCount,
}: {
  members: MemberWithTeams[];
  unmatchedCount: number;
}) {
  const [members] = useState(initialMembers);
  const [rows, setRows] = useState<ParsedMember[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="flex items-center gap-2 rounded-lg border px-4 py-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{members.length} Mitglieder</span>
        </div>
        {unmatchedCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {unmatchedCount} ohne Spieler-Verknüpfung
            </span>
          </div>
        )}
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="rounded-md border bg-white overflow-x-auto">
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
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">Verknüpft</span>
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
              relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors
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
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
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
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vorname</TableHead>
                      <TableHead>Nachname</TableHead>
                      <TableHead>Geburtsdatum</TableHead>
                      <TableHead>E-Mail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.count}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Importiert</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.skipped.length}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Übersprungen</p>
                </div>
              </div>
            </div>

            {result.skipped.length > 0 && (
              <details className="rounded-lg border">
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

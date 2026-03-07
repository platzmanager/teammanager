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
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import Papa from "papaparse";
import { importSkillLevels } from "@/actions/import";

interface LkRow {
  last_name: string;
  first_name: string;
  license: string;
  birth_date: string;
  skill_level: string;
}

interface LkResult {
  updated: number;
  backfilled: number;
  backfilledList: { name: string; license: string }[];
  alreadyUpToDate: number;
  notFound: { name: string; license: string }[];
  total: number;
}

export function LkImport() {
  const [rows, setRows] = useState<LkRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LkResult | null>(null);
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

      const mapped: LkRow[] = parsed.data.map((r) => ({
        last_name: r["Nachname"] ?? "",
        first_name: r["Vorname"] ?? "",
        license: r["ID-Nummer"] ?? "",
        birth_date: r["Geburtsdatum"] ?? "",
        skill_level: r["LK"] ?? "",
      }));

      setRows(mapped);
    };
    reader.readAsText(file);
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

  const previewRows = rows.slice(0, 5);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const data = rows
        .filter((r) => r.last_name && r.first_name && r.skill_level)
        .map((r) => ({
          last_name: r.last_name,
          first_name: r.first_name,
          license: r.license,
          birth_date: r.birth_date,
          skill_level: parseFloat(r.skill_level.replace(",", ".")),
        }));

      const res = await importSkillLevels(data);
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

  return (
    <div className="space-y-6">
      {/* Dropzone */}
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
            <p className="text-sm font-medium">LK-CSV-Datei hierher ziehen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Format: Nachname;Vorname;ID-Nummer;Geburtsdatum;LK;...
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
            <p className="text-xs text-muted-foreground">{rows.length} Spieler erkannt</p>
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
            <h3 className="text-sm font-medium">
              Vorschau
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({rows.length} Spieler)
              </span>
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nachname</TableHead>
                    <TableHead>Vorname</TableHead>
                    <TableHead>ID-Nummer</TableHead>
                    <TableHead>Geburtsdatum</TableHead>
                    <TableHead>LK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell>{row.last_name}</TableCell>
                      <TableCell>{row.first_name}</TableCell>
                      <TableCell>{row.license}</TableCell>
                      <TableCell>{row.birth_date}</TableCell>
                      <TableCell>{row.skill_level}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 5 && (
              <p className="text-xs text-muted-foreground">
                … und {rows.length - 5} weitere Spieler
              </p>
            )}
          </div>

          <Button onClick={handleImport} disabled={loading} className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Aktualisiere…" : `LK für ${rows.length} Spieler aktualisieren`}
          </Button>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.updated}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Aktualisiert</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-blue-50 p-3 dark:bg-blue-950/20">
              <Info className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.backfilled}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500">+ Lizenz ergänzt</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-slate-50 p-3 dark:bg-slate-950/20">
              <Info className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{result.alreadyUpToDate}</p>
                <p className="text-xs text-slate-500">Bereits aktuell</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.notFound.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Nicht gefunden</p>
              </div>
            </div>
          </div>

          {result.backfilledList.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <Info className="h-4 w-4 text-blue-500" />
                {result.backfilledList.length} Lizenz ergänzt
              </summary>
              <div className="border-t px-4 py-2">
                {result.backfilledList.map((p, i) => (
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">
                    {p.name} (Lizenz: {p.license})
                  </p>
                ))}
              </div>
            </details>
          )}

          {result.notFound.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {result.notFound.length} nicht gefunden
              </summary>
              <div className="border-t px-4 py-2">
                {result.notFound.map((p, i) => (
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">
                    {p.name} (Lizenz: {p.license || "—"})
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

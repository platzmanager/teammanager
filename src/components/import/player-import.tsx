"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gender } from "@/lib/types";
import { importPlayers, markPlayersForDeletion } from "@/actions/import";
import { Upload, FileSpreadsheet, Trash2, X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import Papa from "papaparse";

const IMPORT_FIELDS = [
  { key: "first_name", label: "Vorname", required: true },
  { key: "last_name", label: "Nachname", required: true },
  { key: "birth_date", label: "Geburtsdatum", required: true },
  { key: "skill_level", label: "LK", required: true },
  { key: "license", label: "Lizenz", required: false },
  { key: "notes", label: "Bemerkung", required: false },
] as const;

const DELETE_FIELDS = [
  { key: "first_name", label: "Vorname", required: true },
  { key: "last_name", label: "Nachname", required: true },
  { key: "birth_date", label: "Geburtsdatum", required: true },
] as const;

type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
type MappingState = Record<FieldKey, number | -1>;

const EMPTY_MAPPING: MappingState = {
  first_name: -1,
  last_name: -1,
  birth_date: -1,
  skill_level: -1,
  license: -1,
  notes: -1,
};

function autoDetectMapping(headerRow: string[]): MappingState {
  const mapping = { ...EMPTY_MAPPING };
  const matchers: { key: FieldKey; test: (h: string) => boolean }[] = [
    { key: "first_name", test: (h) => h.includes("vorname") || h === "first_name" },
    { key: "last_name", test: (h) => h.includes("nachname") || h === "last_name" || h === "name" },
    { key: "birth_date", test: (h) => h.includes("geburt") || h.includes("birth") || h.includes("datum") },
    { key: "skill_level", test: (h) => h.includes("lk") || h.includes("skill") || h.includes("leistung") },
    { key: "license", test: (h) => h.includes("lizenz") || h.includes("license") },
    { key: "notes", test: (h) => h.includes("bemerkung") || h.includes("note") },
  ];
  const used = new Set<number>();
  for (const matcher of matchers) {
    const idx = headerRow.findIndex((h, i) => !used.has(i) && matcher.test(h.toLowerCase()));
    if (idx !== -1) {
      mapping[matcher.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

interface ImportResult {
  count: number;
  total: number;
  skipped: { row: number; name: string; reason: string }[];
}

interface DeleteResult {
  deleted: { row: number; name: string; uuid: string; gender: string }[];
  notFound: { row: number; name: string }[];
  alreadyDeleted: { row: number; name: string }[];
  skipped: { row: number; name: string; reason: string }[];
  total: number;
}

export function PlayerImport() {
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<MappingState>({ ...EMPTY_MAPPING });
  const [gender, setGender] = useState<Gender>("male");
  const [hasHeader, setHasHeader] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setImportResult(null);
    setDeleteResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
      });
      const lines = parsed.data;
      if (lines.length === 0) return;

      setHeaders(lines[0]);
      setRows(lines);
      setMapping(autoDetectMapping(lines[0]));
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
      if (file && (file.name.endsWith(".csv") || file.name.endsWith(".txt"))) {
        processFile(file);
      }
    },
    [processFile]
  );

  const clearFile = () => {
    setRows([]);
    setHeaders([]);
    setFileName(null);
    setMapping({ ...EMPTY_MAPPING });
    setImportResult(null);
    setDeleteResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fields = deleteMode ? DELETE_FIELDS : IMPORT_FIELDS;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const previewRows = dataRows.slice(0, 5);
  const mappedFields = fields.filter((f) => mapping[f.key] !== -1);

  async function handleImport() {
    setLoading(true);
    setImportResult(null);
    setDeleteResult(null);

    try {
      if (deleteMode) {
        const requiredFields = DELETE_FIELDS.filter((f) => f.required).map((f) => f.key);
        const missing = requiredFields.filter((f) => mapping[f] === -1);
        if (missing.length > 0) {
          const labels = missing.map((f) => DELETE_FIELDS.find((pf) => pf.key === f)?.label ?? f);
          alert(`Pflichtfelder fehlen: ${labels.join(", ")}`);
          setLoading(false);
          return;
        }

        const players = dataRows.map((row) => ({
          first_name: row[mapping.first_name] ?? "",
          last_name: row[mapping.last_name] ?? "",
          birth_date: mapping.birth_date !== -1 ? (row[mapping.birth_date] ?? "") : "",
        }));

        const res = await markPlayersForDeletion(players);
        setDeleteResult(res);
        setRows([]);
        setHeaders([]);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        const requiredFields = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);
        const missing = requiredFields.filter((f) => mapping[f] === -1);
        if (missing.length > 0) {
          const labels = missing.map((f) => IMPORT_FIELDS.find((pf) => pf.key === f)?.label ?? f);
          alert(`Pflichtfelder fehlen: ${labels.join(", ")}`);
          setLoading(false);
          return;
        }

        const col = (key: FieldKey, row: string[]) =>
          mapping[key] !== -1 ? (row[mapping[key]] ?? "") : "";

        const players = dataRows.map((row) => ({
          first_name: col("first_name", row),
          last_name: col("last_name", row),
          birth_date: col("birth_date", row),
          skill_level: parseFloat((col("skill_level", row) || "0").replace(",", ".")),
          gender,
          license: col("license", row) || null,
          notes: col("notes", row) || null,
        }));

        const res = await importPlayers(players);
        setImportResult(res);
        setRows([]);
        setHeaders([]);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Import error:", err);
      alert(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base font-medium">Modus</Label>
          <p className="text-sm text-muted-foreground">
            {deleteMode
              ? "Spieler aus CSV in der Datenbank suchen und als gelöscht markieren (Herren & Damen)"
              : "Spieler aus CSV in die Datenbank importieren"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${!deleteMode ? "text-foreground" : "text-muted-foreground"}`}>
            Import
          </span>
          <Switch
            checked={deleteMode}
            onCheckedChange={setDeleteMode}
          />
          <span className={`text-sm font-medium ${deleteMode ? "text-destructive" : "text-muted-foreground"}`}>
            Löschen
          </span>
        </div>
      </div>

      {/* Gender selector — only for import mode */}
      {!deleteMode && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Geschlecht</Label>
            <p className="text-sm text-muted-foreground">
              {gender === "male" ? "Spieler werden als Herren importiert" : "Spieler werden als Damen importiert"}
            </p>
          </div>
          <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Herren</SelectItem>
              <SelectItem value="female">Damen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Header checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="has-header"
          checked={hasHeader}
          onChange={(e) => setHasHeader(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="has-header">Erste Zeile ist Kopfzeile</Label>
      </div>

      {/* Dropzone */}
      {!fileName ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors
            ${dragOver
              ? "border-primary bg-primary/5"
              : deleteMode
                ? "border-muted-foreground/25 hover:border-destructive/50 hover:bg-destructive/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
            }
          `}
        >
          <div className={`rounded-full p-3 ${deleteMode ? "bg-destructive/10" : "bg-primary/10"}`}>
            <Upload className={`h-6 w-6 ${deleteMode ? "text-destructive" : "text-primary"}`} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              CSV-Datei hierher ziehen
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              oder klicken zum Auswählen (.csv, .txt)
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
            <p className="text-xs text-muted-foreground">
              {dataRows.length} Zeilen erkannt
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Column mapping + preview */}
      {headers.length > 0 && (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Spalten-Zuordnung</h3>
            <div className={`grid gap-3 ${deleteMode ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
              {fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <Select
                    value={String(mapping[field.key])}
                    onValueChange={(v) => setMapping((prev) => ({ ...prev, [field.key]: parseInt(v) }))}
                  >
                    <SelectTrigger
                      className={`w-full ${
                        mapping[field.key] === -1 && field.required
                          ? "border-destructive/50 bg-destructive/5"
                          : ""
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">— Nicht zugeordnet —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview table */}
          {mappedFields.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Vorschau
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({dataRows.length} Zeilen)
                </span>
              </h3>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {mappedFields.map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, ri) => (
                      <TableRow key={ri}>
                        {mappedFields.map((f) => (
                          <TableCell key={f.key}>{row[mapping[f.key]] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {dataRows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  … und {dataRows.length - 5} weitere Zeilen
                </p>
              )}
            </div>
          )}

          {/* Action button */}
          <Button
            onClick={handleImport}
            disabled={loading}
            variant={deleteMode ? "destructive" : "default"}
            className="w-full sm:w-auto"
          >
            {deleteMode ? (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {loading ? "Suche & lösche…" : `${dataRows.length} Spieler zum Löschen suchen`}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {loading ? "Importiere…" : `${dataRows.length} Spieler importieren`}
              </>
            )}
          </Button>
        </>
      )}

      {/* Import result */}
      {importResult && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{importResult.count}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Importiert</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{importResult.skipped.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Übersprungen</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-slate-50 p-3 dark:bg-slate-950/20">
              <Info className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{importResult.total}</p>
                <p className="text-xs text-slate-500">Gesamt</p>
              </div>
            </div>
          </div>

          {/* Skipped details */}
          {importResult.skipped.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {importResult.skipped.length} übersprungen
              </summary>
              <div className="border-t px-4 py-2">
                {importResult.skipped.map((s, i) => (
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">
                    Zeile {s.row}: {s.name} — {s.reason}
                  </p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Delete result */}
      {deleteResult && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{deleteResult.deleted.length}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Gelöscht</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-red-50 p-3 dark:bg-red-950/20">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{deleteResult.notFound.length}</p>
                <p className="text-xs text-red-600 dark:text-red-500">Nicht gefunden</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{deleteResult.skipped.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Übersprungen</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-slate-50 p-3 dark:bg-slate-950/20">
              <Info className="h-5 w-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{deleteResult.alreadyDeleted.length}</p>
                <p className="text-xs text-slate-500">Bereits gelöscht</p>
              </div>
            </div>
          </div>

          {/* Detail lists */}
          {deleteResult.deleted.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {deleteResult.deleted.length} Spieler gelöscht
              </summary>
              <div className="border-t px-4 py-2">
                {deleteResult.deleted.map((p) => (
                  <p key={p.uuid} className="py-0.5 text-sm text-muted-foreground">
                    Zeile {p.row}: {p.name} <span className="text-xs">({p.gender})</span>
                  </p>
                ))}
              </div>
            </details>
          )}

          {deleteResult.notFound.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <XCircle className="h-4 w-4 text-red-500" />
                {deleteResult.notFound.length} nicht gefunden
              </summary>
              <div className="border-t px-4 py-2">
                {deleteResult.notFound.map((p, i) => (
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">
                    Zeile {p.row}: {p.name}
                  </p>
                ))}
              </div>
            </details>
          )}

          {deleteResult.skipped.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {deleteResult.skipped.length} übersprungen
              </summary>
              <div className="border-t px-4 py-2">
                {deleteResult.skipped.map((p, i) => (
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">
                    Zeile {p.row}: {p.name} — {p.reason}
                  </p>
                ))}
              </div>
            </details>
          )}

          {deleteResult.alreadyDeleted.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <Info className="h-4 w-4 text-slate-400" />
                {deleteResult.alreadyDeleted.length} bereits gelöscht
              </summary>
              <div className="border-t px-4 py-2">
                {deleteResult.alreadyDeleted.map((p, i) => (
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">
                    Zeile {p.row}: {p.name}
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

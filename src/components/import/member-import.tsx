"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importMembers } from "@/actions/members";
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle } from "lucide-react";
import Papa from "papaparse";

const IMPORT_FIELDS = [
  { key: "external_id", label: "Mitgliedsnummer", required: false },
  { key: "first_name", label: "Vorname", required: true },
  { key: "last_name", label: "Nachname", required: true },
  { key: "birth_date", label: "Geburtsdatum", required: false },
  { key: "email", label: "E-Mail", required: false },
] as const;

type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];
type MappingState = Record<FieldKey, number | -1>;

const EMPTY_MAPPING: MappingState = {
  external_id: -1,
  first_name: -1,
  last_name: -1,
  birth_date: -1,
  email: -1,
};

function autoDetectMapping(headerRow: string[]): MappingState {
  const mapping = { ...EMPTY_MAPPING };
  const matchers: { key: FieldKey; test: (h: string) => boolean }[] = [
    { key: "external_id", test: (h) => h.includes("mitgliedsnr") || h.includes("mitgliedsnummer") || h === "nr." || h === "nr" || h === "id" || h === "external_id" },
    { key: "first_name", test: (h) => h.includes("vorname") || h === "first_name" },
    { key: "last_name", test: (h) => h.includes("nachname") || h === "last_name" || h === "name" },
    { key: "birth_date", test: (h) => h.includes("geburt") || h.includes("birth") || h.includes("datum") },
    { key: "email", test: (h) => h.includes("mail") || h === "email" || h === "e-mail" },
  ];
  const used = new Set<number>();
  for (const matcher of matchers) {
    const idx = headerRow.findIndex((h, i) => !used.has(i) && matcher.test(h.toLowerCase().trim()));
    if (idx !== -1) {
      mapping[matcher.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

interface ImportResult {
  count: number;
  inserted: number;
  updated: number;
  total: number;
  skipped: { row: number; name: string; reason: string }[];
}

export function MemberImport() {
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<MappingState>({ ...EMPTY_MAPPING });
  const [hasHeader, setHasHeader] = useState(true);
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
      if (file) processFile(file);
    },
    [processFile]
  );

  const clearFile = () => {
    setRows([]);
    setHeaders([]);
    setFileName(null);
    setMapping({ ...EMPTY_MAPPING });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const previewRows = dataRows.slice(0, 5);
  const mappedFields = IMPORT_FIELDS.filter((f) => mapping[f.key] !== -1);

  async function handleImport() {
    const requiredFields = IMPORT_FIELDS.filter((f) => f.required).map((f) => f.key);
    const missing = requiredFields.filter((f) => mapping[f] === -1);
    if (missing.length > 0) {
      const labels = missing.map((f) => IMPORT_FIELDS.find((pf) => pf.key === f)?.label ?? f);
      alert(`Pflichtfelder fehlen: ${labels.join(", ")}`);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const col = (key: FieldKey, row: string[]) =>
        mapping[key] !== -1 ? (row[mapping[key]] ?? "") : "";

      const members = dataRows.map((row) => ({
        external_id: col("external_id", row) || undefined,
        first_name: col("first_name", row),
        last_name: col("last_name", row),
        birth_date: col("birth_date", row) || undefined,
        email: col("email", row) || undefined,
      }));

      const res = await importMembers(members);
      setResult(res);
      setRows([]);
      setHeaders([]);
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
      {/* Header checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="has-header"
          checked={hasHeader}
          onChange={(e) => setHasHeader(e.target.checked)}
          className="h-4 w-4 border-input"
        />
        <Label htmlFor="has-header">Erste Zeile ist Kopfzeile</Label>
      </div>

      {/* Dropzone */}
      {!fileName ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-10 transition-colors
            ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"}
          `}
        >
          <div className="rounded-full p-3 bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Mitglieder-CSV hierher ziehen</p>
            <p className="text-xs text-muted-foreground mt-1">oder klicken zum Auswählen (.csv, .txt)</p>
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
            <p className="text-xs text-muted-foreground">{dataRows.length} Zeilen erkannt</p>
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
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
              {IMPORT_FIELDS.map((field) => (
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
              <div className="border overflow-x-auto">
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
          <Button onClick={handleImport} disabled={loading} className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Importiere…" : `${dataRows.length} Mitglieder importieren`}
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
                <AlertTriangle className="h-4 w-4 text-golden" />
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
  );
}

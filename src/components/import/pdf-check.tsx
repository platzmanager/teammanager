"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  getAllRegisteredPlayers,
  type RegisteredPlayerWithAgeClasses,
} from "@/actions/teams";
import { GENDER_LABELS, AGE_CLASS_CONFIG } from "@/lib/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchStatus = "found" | "questionable" | "not_found";

interface CheckResult {
  player: RegisteredPlayerWithAgeClasses;
  status: MatchStatus;
  detail: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[ßẞ]/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateDE(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function checkPlayer(
  player: RegisteredPlayerWithAgeClasses,
  normalizedPdf: string,
  rawPdf: string,
): CheckResult {
  const normalizedFirst = normalizeText(player.first_name);
  const normalizedLast = normalizeText(player.last_name);
  // Match various formats: "Firstname Lastname", "Lastname Firstname", "Lastname, Firstname"
  const nameVariants = [
    `${normalizedFirst} ${normalizedLast}`,
    `${normalizedLast} ${normalizedFirst}`,
    `${normalizedLast}, ${normalizedFirst}`,
  ];

  const dateDE = formatDateDE(player.birth_date);
  const [y, m, d] = player.birth_date.split("-");
  const dateDE_noZero = `${parseInt(d)}.${parseInt(m)}.${y}`;

  const nameFound = nameVariants.some((v) => normalizedPdf.includes(v));

  const dateFound =
    rawPdf.includes(dateDE) ||
    rawPdf.includes(dateDE_noZero) ||
    rawPdf.includes(player.birth_date);

  if (nameFound && dateFound) {
    return { player, status: "found", detail: "Name und Geburtsdatum gefunden" };
  }

  const lastNameFound = normalizedPdf.includes(normalizedLast);
  const firstNameFound = normalizedPdf.includes(normalizedFirst);

  if (nameFound && !dateFound) {
    return {
      player,
      status: "questionable",
      detail: `Name gefunden, aber Geburtsdatum (${dateDE}) nicht im PDF`,
    };
  }

  if (lastNameFound && dateFound) {
    return {
      player,
      status: "questionable",
      detail: "Nachname und Geburtsdatum gefunden, Vorname fehlt",
    };
  }

  if (lastNameFound && firstNameFound && !nameFound) {
    return {
      player,
      status: "questionable",
      detail: "Vor- und Nachname einzeln gefunden (nicht zusammenhängend)",
    };
  }

  if (lastNameFound) {
    return {
      player,
      status: "questionable",
      detail: `Nur Nachname "${player.last_name}" gefunden`,
    };
  }

  return {
    player,
    status: "not_found",
    detail: "Weder Name noch Geburtsdatum im PDF gefunden",
  };
}

function playerLabel(r: CheckResult): string {
  const dateDE = formatDateDE(r.player.birth_date);
  const genderLabel = GENDER_LABELS[r.player.gender];
  const ageLabels = r.player.age_classes
    .map((ac) => AGE_CLASS_CONFIG[ac].label)
    .join(", ");
  return `${r.player.first_name} ${r.player.last_name} (${dateDE}) — ${genderLabel}: ${ageLabels}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfCheck() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- PDF Upload & Text Extraction ----

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResults([]);
    setProgress(null);
    setPdfText(null);
    setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fullText += textContent.items.map((item: any) => item.str).join(" ") + "\n";
      }

      setPdfText(fullText);
      setPageCount(pdf.numPages);
    } catch (err) {
      alert(`PDF konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`);
      setFileName(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const clearFile = () => {
    setFileName(null);
    setPdfText(null);
    setPageCount(0);
    setResults([]);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Check Logic ----

  async function handleCheck() {
    if (!pdfText) return;

    setChecking(true);
    setResults([]);

    try {
      const players = await getAllRegisteredPlayers();
      setProgress({ done: 0, total: players.length });

      const normalizedPdf = normalizeText(pdfText);
      const newResults: CheckResult[] = [];

      for (let i = 0; i < players.length; i++) {
        const result = checkPlayer(players[i], normalizedPdf, pdfText);
        newResults.push(result);

        if (i % 3 === 0 || i === players.length - 1) {
          setResults([...newResults]);
          setProgress({ done: i + 1, total: players.length });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setChecking(false);
    }
  }

  // ---- Computed ----

  const found = results.filter((r) => r.status === "found");
  const questionable = results.filter((r) => r.status === "questionable");
  const notFound = results.filter((r) => r.status === "not_found");
  const done = progress !== null && progress.done === progress.total && !checking;

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
            <p className="text-sm font-medium">Lizenz-PDF hierher ziehen</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF mit allen lizenzierten Spielern des Vereins (.pdf)
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "PDF wird gelesen…"
                : `${pageCount} Seite${pageCount !== 1 ? "n" : ""}, ${(pdfText?.length ?? 0).toLocaleString("de-DE")} Zeichen extrahiert`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile} className="shrink-0" disabled={checking}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Check button */}
      {pdfText && !done && (
        <Button onClick={handleCheck} disabled={checking || loading} className="w-full sm:w-auto">
          <Search className="mr-2 h-4 w-4" />
          {checking ? "Prüfe…" : "Lizenzen prüfen"}
        </Button>
      )}

      {/* Progress */}
      {checking && progress && (
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">
            Prüfe Spieler… {progress.done}/{progress.total}
          </p>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary cards */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{found.length}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Lizenz vorhanden</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{questionable.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Fraglich</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-red-50 p-3 dark:bg-red-950/20">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{notFound.length}</p>
                <p className="text-xs text-red-600 dark:text-red-500">Keine Lizenz</p>
              </div>
            </div>
          </div>

          {/* Found (collapsed) */}
          {found.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {found.length} Lizenz vorhanden
              </summary>
              <div className="border-t px-4 py-2">
                {found.map((r) => (
                  <p key={r.player.uuid} className="py-0.5 text-sm text-muted-foreground">
                    {playerLabel(r)}
                  </p>
                ))}
              </div>
            </details>
          )}

          {/* Questionable (expanded) */}
          {questionable.length > 0 && (
            <details open className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {questionable.length} fraglich
              </summary>
              <div className="border-t px-4 py-2">
                {questionable.map((r) => (
                  <div key={r.player.uuid} className="py-1">
                    <p className="text-sm">{playerLabel(r)}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Not found (expanded) */}
          {notFound.length > 0 && (
            <details open className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <XCircle className="h-4 w-4 text-red-500" />
                {notFound.length} keine Lizenz
              </summary>
              <div className="border-t px-4 py-2">
                {notFound.map((r) => (
                  <div key={r.player.uuid} className="py-1">
                    <p className="text-sm">{playerLabel(r)}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

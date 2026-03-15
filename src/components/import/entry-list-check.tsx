"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
import { getRegisteredPlayers, getAllClubPlayers } from "@/actions/teams";
import type { Player, Gender, AgeClass } from "@/lib/types";
import { GENDER_LABELS, AGE_CLASS_CONFIG } from "@/lib/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PdfPlayer {
  rank: string;
  lastName: string;
  firstName: string;
  nationality: string;
  licenseId: string;
  skillLevel: string;
  dr: string;
}

type MatchType = "id" | "id_and_name" | "name_exact" | "name_fuzzy";

interface MatchedPlayer {
  systemPlayer: Player;
  pdfPlayer: PdfPlayer;
  matchType: MatchType;
  detail: string;
}

interface UnmatchedSystemPlayer {
  systemPlayer: Player;
  detail: string;
}

interface UnmatchedPdfPlayer {
  pdfPlayer: PdfPlayer;
  detail: string;
}

interface CheckResult {
  matched: MatchedPlayer[];
  notInPdf: UnmatchedSystemPlayer[];
  notInSystem: UnmatchedPdfPlayer[];
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ßẞ]/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// PDF table parsing
// ---------------------------------------------------------------------------

interface TextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

function groupIntoRows(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [];
  let currentY: number | null = null;
  let currentPage: number | null = null;

  for (const item of sorted) {
    if (
      currentY === null ||
      currentPage !== item.page ||
      Math.abs(item.y - currentY) > 3
    ) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
      currentPage = item.page;
    } else {
      currentRow.push(item);
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows;
}

function tryParsePlayerRow(row: TextItem[]): PdfPlayer | null {
  if (row.length < 2) return null;

  const firstStr = row[0].str.trim();
  let rank = "";
  let nameStr = "";
  let restStartIdx = 0;

  // Case 1: First item is just a rank number (e.g., "1", "25")
  if (/^\d{1,3}$/.test(firstStr)) {
    rank = firstStr;
    nameStr = row[1]?.str.trim() ?? "";
    restStartIdx = 2;
  }
  // Case 2: Rank + name combined (e.g., "100 Coy, Remy Carlos")
  else {
    const m = firstStr.match(/^(\d{1,3})\s+(.+)/);
    if (m) {
      rank = m[1];
      nameStr = m[2];
      restStartIdx = 1;
    }
  }

  // Must have rank and a comma-separated name
  if (!rank || !nameStr.includes(",")) return null;

  const [lastName, firstName] = nameStr.split(",", 2).map((s) => s.trim());
  if (!lastName) return null;

  // Join remaining items and extract nationality, ID-Nr., and LK via regex
  const restText = row.slice(restStartIdx).map((r) => r.str).join(" ");
  const natMatch = restText.match(/\b([A-Z]{2,3})\*?\b/);
  const idMatch = restText.match(/(\d{7,10})/);
  const lkMatch = restText.match(/LK\s*(\d+[,.]?\d*)/);

  return {
    rank,
    lastName,
    firstName,
    nationality: natMatch?.[1] ?? "",
    licenseId: idMatch?.[1] ?? "",
    skillLevel: lkMatch?.[1] ?? "",
    dr: "",
  };
}

function parsePdfPlayers(textItems: TextItem[]): PdfPlayer[] {
  // Find all "Ra. Name" header items to identify table section X positions
  const headerItems = textItems.filter(
    (item) => item.str.startsWith("Ra.") && item.str.includes("Name"),
  );
  if (headerItems.length === 0) return [];

  // Unique X positions for table sections (e.g., left column and right column)
  const sectionXs = [...new Set(headerItems.map((h) => h.x))].sort(
    (a, b) => a - b,
  );

  // Assign each item to a section based on X proximity
  function getSectionIndex(x: number): number | null {
    for (let i = sectionXs.length - 1; i >= 0; i--) {
      if (x >= sectionXs[i] - 10) return i;
    }
    return null; // Not part of any table section
  }

  // Split items by section
  const sectionItems: TextItem[][] = sectionXs.map(() => []);
  for (const item of textItems) {
    const si = getSectionIndex(item.x);
    if (si !== null) sectionItems[si].push(item);
  }

  // Parse each section independently
  const players: PdfPlayer[] = [];
  for (const items of sectionItems) {
    const rows = groupIntoRows(items);
    for (const row of rows) {
      const player = tryParsePlayerRow(row);
      if (player) players.push(player);
    }
  }

  // Sort by rank number
  players.sort((a, b) => (parseInt(a.rank, 10) || 0) - (parseInt(b.rank, 10) || 0));
  return players;
}

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

interface DetectedCategory {
  gender: Gender;
  ageClass: AgeClass;
}

function detectGenderAndAgeClass(fullText: string): DetectedCategory | null {
  const patterns: Array<{ regex: RegExp; gender: Gender; ageClass: AgeClass }> = [
    { regex: /juniorinnen\s*u\s*18/i, gender: "female", ageClass: "u18" },
    { regex: /junioren\s*u\s*18/i, gender: "male", ageClass: "u18" },
    { regex: /m[aä]dchen\s*u\s*15/i, gender: "female", ageClass: "u15" },
    { regex: /knaben\s*u\s*15/i, gender: "male", ageClass: "u15" },
    { regex: /bambini\s*u\s*12/i, gender: "male", ageClass: "u12" },
    { regex: /midcourt\s*u\s*10/i, gender: "male", ageClass: "u10" },
    { regex: /kleinfeld\s*u\s*9/i, gender: "male", ageClass: "u9" },
    { regex: /damen\s*60/i, gender: "female", ageClass: "60" },
    { regex: /damen\s*50/i, gender: "female", ageClass: "50" },
    { regex: /damen\s*40/i, gender: "female", ageClass: "40" },
    { regex: /damen\s*30/i, gender: "female", ageClass: "30" },
    { regex: /herren\s*60/i, gender: "male", ageClass: "60" },
    { regex: /herren\s*50/i, gender: "male", ageClass: "50" },
    { regex: /herren\s*40/i, gender: "male", ageClass: "40" },
    { regex: /herren\s*30/i, gender: "male", ageClass: "30" },
    { regex: /\bdamen\b/i, gender: "female", ageClass: "all" },
    { regex: /\bherren\b/i, gender: "male", ageClass: "all" },
  ];

  const headerText = fullText.slice(0, 500);
  for (const { regex, gender, ageClass } of patterns) {
    if (regex.test(headerText)) {
      return { gender, ageClass };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function stripTitle(name: string): string {
  return name.replace(/^(Dr\.\s*|Prof\.\s*)/i, "");
}

function pdfPlayerKey(pp: PdfPlayer): string {
  return pp.licenseId || `${pp.lastName}_${pp.firstName}`;
}

function describeMatch(type: MatchType): string {
  switch (type) {
    case "id": return "ID-Nr. stimmt überein";
    case "id_and_name": return "ID-Nr. und Name stimmen überein";
    case "name_exact": return "Name stimmt überein (Fallback, keine ID-Nr. im System)";
    case "name_fuzzy": return "Name ähnlich (Fuzzy-Fallback, keine ID-Nr. im System)";
  }
}

function findMatchInPdf(
  systemPlayer: Player,
  pdfPlayers: PdfPlayer[],
): { pdfPlayer: PdfPlayer; matchType: MatchType } | null {
  const sysLast = normalizeText(systemPlayer.last_name);
  const sysFirst = normalizeText(systemPlayer.first_name);

  // Primary: match by ID-Nr. (license number)
  if (systemPlayer.license) {
    const idMatch = pdfPlayers.find((pp) => pp.licenseId === systemPlayer.license);
    if (idMatch) {
      // Verify name also matches for extra confidence
      const nameAlsoMatches =
        normalizeText(stripTitle(idMatch.lastName)) === sysLast &&
        normalizeText(idMatch.firstName) === sysFirst;
      return {
        pdfPlayer: idMatch,
        matchType: nameAlsoMatches ? "id_and_name" : "id",
      };
    }
  }

  // Fallback: match by name (only when system player has no license number)
  if (!systemPlayer.license) {
    // Exact name match (strip titles like "Dr." from PDF names)
    const exactMatch = pdfPlayers.find(
      (pp) =>
        normalizeText(stripTitle(pp.lastName)) === sysLast &&
        normalizeText(pp.firstName) === sysFirst,
    );
    if (exactMatch) return { pdfPlayer: exactMatch, matchType: "name_exact" };

    // Fuzzy: last name exact + first name prefix (min 3 chars)
    if (sysFirst.length >= 3) {
      const fuzzyMatch = pdfPlayers.find((pp) => {
        const ppLast = normalizeText(stripTitle(pp.lastName));
        const ppFirst = normalizeText(pp.firstName);
        return (
          ppLast === sysLast &&
          (ppFirst.startsWith(sysFirst.slice(0, 3)) ||
            sysFirst.startsWith(ppFirst.slice(0, 3)))
        );
      });
      if (fuzzyMatch) return { pdfPlayer: fuzzyMatch, matchType: "name_fuzzy" };
    }
  }

  return null;
}

function isClubPlayer(
  pp: PdfPlayer,
  allClubPlayers: Pick<Player, "uuid" | "first_name" | "last_name" | "license" | "birth_date" | "gender">[],
): boolean {
  // Primary: match by license/ID-Nr.
  if (pp.licenseId) {
    if (allClubPlayers.some((cp) => cp.license === pp.licenseId)) return true;
  }

  // Fallback: match by name (strip titles like "Dr." from PDF names)
  const ppLast = normalizeText(stripTitle(pp.lastName));
  const ppFirst = normalizeText(pp.firstName);
  return allClubPlayers.some(
    (cp) =>
      normalizeText(cp.last_name) === ppLast &&
      normalizeText(cp.first_name) === ppFirst,
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntryListCheck() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfPlayers, setPdfPlayers] = useState<PdfPlayer[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<CheckResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detectedGender, setDetectedGender] = useState<Gender | null>(null);
  const [detectedAgeClass, setDetectedAgeClass] = useState<AgeClass | null>(null);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [selectedAgeClass, setSelectedAgeClass] = useState<AgeClass | null>(null);

  const effectiveGender = selectedGender ?? detectedGender;
  const effectiveAgeClass = selectedAgeClass ?? detectedAgeClass;

  // ---- PDF upload & parsing ----

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setPdfPlayers([]);
    setResults(null);
    setProgress(null);
    setDetectedGender(null);
    setDetectedAgeClass(null);
    setSelectedGender(null);
    setSelectedAgeClass(null);
    setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const textItems: TextItem[] = [];
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if ("str" in item && item.str.trim()) {
            textItems.push({
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              page: i,
            });
            fullText += item.str + " ";
          }
        }
        fullText += "\n";
      }

      setPageCount(pdf.numPages);

      const players = parsePdfPlayers(textItems);
      setPdfPlayers(players);

      const detected = detectGenderAndAgeClass(fullText);
      if (detected) {
        setDetectedGender(detected.gender);
        setDetectedAgeClass(detected.ageClass);
      }
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
    setPdfPlayers([]);
    setPageCount(0);
    setResults(null);
    setProgress(null);
    setDetectedGender(null);
    setDetectedAgeClass(null);
    setSelectedGender(null);
    setSelectedAgeClass(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Check logic ----

  async function handleCheck() {
    if (!effectiveGender || !effectiveAgeClass || pdfPlayers.length === 0) return;

    setChecking(true);
    setResults(null);
    setProgress({ done: 0, total: 0 });

    try {
      const [systemPlayers, allClubPlayersList] = await Promise.all([
        getRegisteredPlayers(effectiveGender, effectiveAgeClass),
        getAllClubPlayers(),
      ]);

      const total = systemPlayers.length + pdfPlayers.length;
      setProgress({ done: 0, total });

      const matched: MatchedPlayer[] = [];
      const notInPdf: UnmatchedSystemPlayer[] = [];
      const matchedPdfKeys = new Set<string>();

      // Direction 1: system → PDF
      for (let i = 0; i < systemPlayers.length; i++) {
        const sp = systemPlayers[i];
        const match = findMatchInPdf(sp, pdfPlayers);

        if (match) {
          matched.push({
            systemPlayer: sp,
            pdfPlayer: match.pdfPlayer,
            matchType: match.matchType,
            detail: describeMatch(match.matchType),
          });
          matchedPdfKeys.add(pdfPlayerKey(match.pdfPlayer));
        } else {
          notInPdf.push({
            systemPlayer: sp,
            detail: sp.license
              ? `ID-Nr. ${sp.license} nicht in der Meldeliste gefunden`
              : "Keine ID-Nr. im System, Name nicht in der Meldeliste gefunden",
          });
        }

        if (i % 3 === 0 || i === systemPlayers.length - 1) {
          setProgress({ done: i + 1, total });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // Direction 2: PDF → system (only show club players)
      const notInSystem: UnmatchedPdfPlayer[] = [];

      for (let i = 0; i < pdfPlayers.length; i++) {
        const pp = pdfPlayers[i];
        if (matchedPdfKeys.has(pdfPlayerKey(pp))) continue;

        if (isClubPlayer(pp, allClubPlayersList)) {
          notInSystem.push({
            pdfPlayer: pp,
            detail: "In der Meldeliste, aber nicht für diese Altersklasse gemeldet",
          });
        }

        if (i % 5 === 0 || i === pdfPlayers.length - 1) {
          setProgress({ done: systemPlayers.length + i + 1, total });
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      setResults({ matched, notInPdf, notInSystem });
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setChecking(false);
    }
  }

  // ---- Computed ----

  const done = results !== null && !checking;
  const canCheck = pdfPlayers.length > 0 && effectiveGender && effectiveAgeClass && !loading;

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
            <p className="text-sm font-medium">Meldelisten-PDF hierher ziehen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Offizielle Meldeliste des Verbands (.pdf)
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
                : `${pageCount} Seite${pageCount !== 1 ? "n" : ""}, ${pdfPlayers.length} Spieler erkannt`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile} className="shrink-0" disabled={checking}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Gender / age class selectors */}
      {pdfPlayers.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          {detectedGender && detectedAgeClass && (
            <p className="text-sm text-muted-foreground">
              Erkannt:{" "}
              <span className="font-medium">
                {GENDER_LABELS[detectedGender]} {AGE_CLASS_CONFIG[detectedAgeClass].label}
              </span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Geschlecht</Label>
              <Select
                value={effectiveGender ?? ""}
                onValueChange={(v) => setSelectedGender(v as Gender)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Herren</SelectItem>
                  <SelectItem value="female">Damen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Altersklasse</Label>
              <Select
                value={effectiveAgeClass ?? ""}
                onValueChange={(v) => setSelectedAgeClass(v as AgeClass)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AGE_CLASS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Preview table */}
      {pdfPlayers.length > 0 && !results && (
        <div className="rounded-lg border">
          <div className="px-4 py-2.5 border-b">
            <p className="text-sm font-medium">
              Vorschau ({pdfPlayers.length} Spieler im PDF)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Ra.</th>
                  <th className="px-4 py-2">Nachname</th>
                  <th className="px-4 py-2">Vorname</th>
                  <th className="px-4 py-2">ID-Nr.</th>
                  <th className="px-4 py-2">LK</th>
                </tr>
              </thead>
              <tbody>
                {pdfPlayers.slice(0, 5).map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-1.5 text-muted-foreground">{p.rank}</td>
                    <td className="px-4 py-1.5">{p.lastName}</td>
                    <td className="px-4 py-1.5">{p.firstName}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">{p.licenseId}</td>
                    <td className="px-4 py-1.5 text-muted-foreground">{p.skillLevel}</td>
                  </tr>
                ))}
                {pdfPlayers.length > 5 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-1.5 text-xs text-muted-foreground">
                      … und {pdfPlayers.length - 5} weitere
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check button */}
      {canCheck && !done && (
        <Button onClick={handleCheck} disabled={checking || loading} className="w-full sm:w-auto">
          <Search className="mr-2 h-4 w-4" />
          {checking ? "Gleiche ab…" : "Abgleichen"}
        </Button>
      )}

      {/* Progress */}
      {checking && progress && progress.total > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">
            Gleiche ab… {progress.done}/{progress.total}
          </p>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{results.matched.length}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Abgeglichen</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-red-50 p-3 dark:bg-red-950/20">
              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{results.notInPdf.length}</p>
                <p className="text-xs text-red-600 dark:text-red-500">Nicht in Meldeliste</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/20">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{results.notInSystem.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">Nicht gemeldet</p>
              </div>
            </div>
          </div>

          {/* Matched (collapsed) */}
          {results.matched.length > 0 && (
            <details className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {results.matched.length} abgeglichen
              </summary>
              <div className="border-t px-4 py-2">
                {results.matched.map((r) => (
                  <div key={r.systemPlayer.uuid} className="py-1">
                    <p className="text-sm">
                      {r.systemPlayer.first_name} {r.systemPlayer.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Not in PDF (expanded) */}
          {results.notInPdf.length > 0 && (
            <details open className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <XCircle className="h-4 w-4 text-red-500" />
                {results.notInPdf.length} nicht in Meldeliste
              </summary>
              <div className="border-t px-4 py-2">
                {results.notInPdf.map((r) => (
                  <div key={r.systemPlayer.uuid} className="py-1">
                    <p className="text-sm">
                      {r.systemPlayer.first_name} {r.systemPlayer.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Not in system (expanded) */}
          {results.notInSystem.length > 0 && (
            <details open className="rounded-lg border">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {results.notInSystem.length} nicht gemeldet
              </summary>
              <div className="border-t px-4 py-2">
                {results.notInSystem.map((r, i) => (
                  <div key={i} className="py-1">
                    <p className="text-sm">
                      {r.pdfPlayer.firstName} {r.pdfPlayer.lastName}
                      {r.pdfPlayer.licenseId && (
                        <span className="text-muted-foreground"> (ID: {r.pdfPlayer.licenseId})</span>
                      )}
                    </p>
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

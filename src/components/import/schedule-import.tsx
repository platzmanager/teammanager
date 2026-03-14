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
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import Papa from "papaparse";
import { importSchedule } from "@/actions/import";
import { Team } from "@/lib/types";

interface ParsedMatch {
  match_date: string;
  match_time: string;
  age_class_raw: string;
  league_class: string;
  league: string;
  league_group: string;
  home_team: string;
  away_team: string;
  match_number: string;
  location: string;
  gender: "male" | "female";
  age_class: string;
}

interface ScheduleResult {
  imported: number;
  teamsEnriched: number;
  skipped: { reason: string }[];
}

function parseAltersklasse(raw: string): { gender: "male" | "female"; age_class: string } {
  const trimmed = raw.trim();
  if (trimmed.startsWith("Damen")) {
    const num = trimmed.replace("Damen", "").trim();
    return { gender: "female", age_class: num || "all" };
  }
  if (trimmed.startsWith("Herren")) {
    const num = trimmed.replace("Herren", "").trim();
    return { gender: "male", age_class: num || "all" };
  }
  return { gender: "male", age_class: "all" };
}

function parseDateDE(dateStr: string): string {
  const m = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return dateStr;
}

export function ScheduleImport({ teams }: { teams: Team[] }) {
  const [rows, setRows] = useState<ParsedMatch[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Team mapping: key = "gender|age_class", value = team_id or "__skip__"
  const [teamMapping, setTeamMapping] = useState<Record<string, string>>({});
  // Own team name mapping: key = "gender|age_class", value = CSV team name
  const [ownTeamNames, setOwnTeamNames] = useState<Record<string, string>>({});
  // Multi-team mapping: groupKey → { teamId → csvTeamName } for groups with multiple candidates
  const [multiTeamMapping, setMultiTeamMapping] = useState<Record<string, Record<string, string>>>({});

  // Compute groups from CSV with match counts
  const groupKeys = [...new Set(rows.map((r) => `${r.gender}|${r.age_class}`))];
  const groups: { key: string; label: string; matchCount: number; candidates: Team[]; csvTeamNames: string[]; detectedOwnNames: string[] }[] = [];

  for (const key of groupKeys) {
    const [gender, ageClass] = key.split("|");
    const candidates = teams.filter(
      (t) => t.gender === gender && t.age_class === ageClass
    );
    const label = `${gender === "female" ? "Damen" : "Herren"} ${ageClass === "all" ? "" : ageClass}`.trim();
    const groupRows = rows.filter((r) => `${r.gender}|${r.age_class}` === key);
    const matchCount = groupRows.length;
    const nameSet = new Set<string>();
    for (const r of groupRows) {
      if (r.home_team) nameSet.add(r.home_team);
      if (r.away_team) nameSet.add(r.away_team);
    }
    const csvTeamNames = [...nameSet].sort();

    // Detect own team names for multi-team groups by splitting on league_group
    const detectedOwnNames: string[] = [];
    if (candidates.length > 1) {
      const subGroups = new Map<string, ParsedMatch[]>();
      for (const r of groupRows) {
        const sg = r.league_group || "__default__";
        const existing = subGroups.get(sg) ?? [];
        existing.push(r);
        subGroups.set(sg, existing);
      }
      for (const [, subMatches] of subGroups) {
        const subNames = new Set<string>();
        for (const m of subMatches) {
          if (m.home_team) subNames.add(m.home_team);
          if (m.away_team) subNames.add(m.away_team);
        }
        const ownName = [...subNames].find((name) =>
          subMatches.every((m) => m.home_team === name || m.away_team === name)
        );
        if (ownName && !detectedOwnNames.includes(ownName)) {
          detectedOwnNames.push(ownName);
        }
      }
    }

    groups.push({ key, label, matchCount, candidates, csvTeamNames, detectedOwnNames });
  }

  // Auto-select if only one candidate (single-team groups only)
  const effectiveMapping: Record<string, string> = {};
  for (const g of groups) {
    if (teamMapping[g.key]) {
      effectiveMapping[g.key] = teamMapping[g.key];
    } else if (g.candidates.length === 1) {
      effectiveMapping[g.key] = g.candidates[0].id;
    }
  }

  // Auto-detect own team name: the name appearing in every row of the group (single-team groups)
  const effectiveOwnNames: Record<string, string> = {};
  for (const g of groups) {
    if (g.candidates.length > 1) continue;
    if (ownTeamNames[g.key]) {
      effectiveOwnNames[g.key] = ownTeamNames[g.key];
    } else {
      const groupRows = rows.filter((r) => `${r.gender}|${r.age_class}` === g.key);
      const autoName = g.csvTeamNames.find((name) =>
        groupRows.every((r) => r.home_team === name || r.away_team === name)
      );
      if (autoName) effectiveOwnNames[g.key] = autoName;
    }
  }

  // Multi-team mapping: auto-assign based on Roman numeral suffix → rank
  const effectiveMultiMapping: Record<string, Record<string, string>> = {};
  for (const g of groups) {
    if (g.candidates.length <= 1) continue;
    if (multiTeamMapping[g.key] && Object.keys(multiTeamMapping[g.key]).length > 0) {
      effectiveMultiMapping[g.key] = multiTeamMapping[g.key];
    } else if (g.detectedOwnNames.length === g.candidates.length) {
      const sortedCandidates = [...g.candidates].sort((a, b) => a.rank - b.rank);
      const romanRank = (s: string) => {
        if (/ VI$/i.test(s)) return 6;
        if (/ V$/i.test(s)) return 5;
        if (/ IV$/i.test(s)) return 4;
        if (/ III$/i.test(s)) return 3;
        if (/ II$/i.test(s)) return 2;
        return 1;
      };
      const sortedNames = [...g.detectedOwnNames].sort((a, b) => romanRank(a) - romanRank(b));
      const autoMap: Record<string, string> = {};
      for (let i = 0; i < sortedCandidates.length; i++) {
        autoMap[sortedCandidates[i].id] = sortedNames[i];
      }
      effectiveMultiMapping[g.key] = autoMap;
    }
  }

  const allMapped = groups.every((g) => {
    if (g.candidates.length > 1) {
      if (effectiveMapping[g.key] === "__skip__") return true;
      const multiMap = effectiveMultiMapping[g.key];
      if (!multiMap) return false;
      return g.candidates.every((t) => multiMap[t.id]);
    }
    const mapping = effectiveMapping[g.key];
    if (!mapping || mapping === "__skip__") return !!mapping;
    return !!effectiveOwnNames[g.key];
  });

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setResult(null);
    setTeamMapping({});
    setOwnTeamNames({});
    setMultiTeamMapping({});

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = Papa.parse<Record<string, string>>(text, {
        delimiter: ";",
        header: true,
        skipEmptyLines: true,
      });

      const mapped: ParsedMatch[] = parsed.data.map((r) => {
        const { gender, age_class } = parseAltersklasse(r["Altersklasse"] ?? "");
        return {
          match_date: parseDateDE(r["Spieltermin"] ?? ""),
          match_time: r["Uhrzeit"] ?? "",
          age_class_raw: r["Altersklasse"] ?? "",
          league_class: r["Spielklasse"] ?? "",
          league: r["Liga"] ?? "",
          league_group: r["Gruppe"] ?? "",
          home_team: r["Heimmannschaft"] ?? "",
          away_team: r["Gastmannschaft"] ?? "",
          match_number: r["Spiel-Nr."] ?? "",
          location: r["Spielort"] ?? "",
          gender,
          age_class,
        };
      });

      setRows(mapped);
    };
    reader.readAsText(file, "windows-1252");
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
    setTeamMapping({});
    setOwnTeamNames({});
    setMultiTeamMapping({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const previewRows = rows.slice(0, 5);

  async function handleImport() {
    setLoading(true);
    setResult(null);
    try {
      const fullMapping: Record<string, string> = {};
      const fullOwnNames: Record<string, string> = {};

      // Single-team groups: simple keys
      for (const [key, val] of Object.entries(effectiveMapping)) {
        if (val !== "__skip__") {
          fullMapping[key] = val;
          if (effectiveOwnNames[key]) fullOwnNames[key] = effectiveOwnNames[key];
        }
      }

      // Multi-team groups: compound keys (gender|age_class|csvTeamName)
      for (const g of groups) {
        if (g.candidates.length <= 1) continue;
        if (effectiveMapping[g.key] === "__skip__") continue;
        const multiMap = effectiveMultiMapping[g.key];
        if (!multiMap) continue;
        for (const [teamId, csvName] of Object.entries(multiMap)) {
          if (csvName && csvName !== "__none__") {
            const compoundKey = `${g.key}|${csvName}`;
            fullMapping[compoundKey] = teamId;
            fullOwnNames[compoundKey] = csvName;
          }
        }
      }

      const res = await importSchedule(
        rows.filter((r) => {
          const key = `${r.gender}|${r.age_class}`;
          return fullMapping[key]
            || fullMapping[`${key}|${r.home_team}`]
            || fullMapping[`${key}|${r.away_team}`];
        }).map((r) => ({
          match_date: r.match_date,
          match_time: r.match_time,
          home_team: r.home_team,
          away_team: r.away_team,
          match_number: r.match_number,
          location: r.location,
          gender: r.gender,
          age_class: r.age_class,
          league_class: r.league_class,
          league: r.league,
          league_group: r.league_group,
        })),
        fullMapping,
        fullOwnNames
      );
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
            <p className="text-sm font-medium">Spielplan-CSV hierher ziehen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vereinsspielplan-Export (.csv)
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
            <p className="text-xs text-muted-foreground">{rows.length} Spiele erkannt</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Team mapping */}
      {rows.length > 0 && groups.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-medium">Mannschafts-Zuordnung</h3>
          <p className="text-xs text-muted-foreground">
            Ordne die Altersklassen aus dem CSV den Mannschaften zu. Nicht benötigte Gruppen können übersprungen werden.
          </p>
          <div className="grid gap-4">
            {groups.map((g) => {
              const isSkipped = effectiveMapping[g.key] === "__skip__";
              const isMultiTeam = g.candidates.length > 1;

              if (isMultiTeam) {
                const multiMap = effectiveMultiMapping[g.key] ?? {};
                const usedNames = Object.values(multiMap).filter((v) => v && v !== "__none__");
                const dropdownNames = g.detectedOwnNames.length > 0 ? g.detectedOwnNames : g.csvTeamNames;

                return (
                  <div key={g.key} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {g.label}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          ({g.matchCount} Spiele, {g.candidates.length} Mannschaften)
                        </span>
                      </p>
                      {isSkipped ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTeamMapping((prev) => {
                            const next = { ...prev };
                            delete next[g.key];
                            return next;
                          })}
                        >
                          Doch importieren
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => setTeamMapping((prev) => ({ ...prev, [g.key]: "__skip__" }))}
                        >
                          Überspringen
                        </Button>
                      )}
                    </div>
                    {isSkipped ? (
                      <p className="text-xs text-muted-foreground">Diese Gruppe wird nicht importiert.</p>
                    ) : (
                      <div className="grid gap-2">
                        {[...g.candidates].sort((a, b) => a.rank - b.rank).map((t) => (
                          <div key={t.id} className="grid gap-2 sm:grid-cols-2 items-center">
                            <span className="text-sm">{t.name}</span>
                            <Select
                              value={multiMap[t.id] ?? ""}
                              onValueChange={(v) =>
                                setMultiTeamMapping((prev) => ({
                                  ...prev,
                                  [g.key]: { ...(prev[g.key] ?? {}), [t.id]: v },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="CSV-Team wählen…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Nicht zuordnen</SelectItem>
                                {dropdownNames.map((name) => (
                                  <SelectItem
                                    key={name}
                                    value={name}
                                    disabled={usedNames.includes(name) && multiMap[t.id] !== name}
                                  >
                                    {name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={g.key} className="grid gap-2 sm:grid-cols-2 rounded-md border p-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {g.label}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({g.matchCount} Spiele)
                      </span>
                    </label>
                    <Select
                      value={effectiveMapping[g.key] ?? ""}
                      onValueChange={(v) =>
                        setTeamMapping((prev) => ({ ...prev, [g.key]: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={g.candidates.length === 0 ? "Keine Mannschaft vorhanden" : "Mannschaft wählen…"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">Nicht importieren</SelectItem>
                        {g.candidates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {effectiveMapping[g.key] && !isSkipped && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Eigene Mannschaft im CSV</label>
                      <Select
                        value={effectiveOwnNames[g.key] ?? ""}
                        onValueChange={(v) =>
                          setOwnTeamNames((prev) => ({ ...prev, [g.key]: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Teamname wählen…" />
                        </SelectTrigger>
                        <SelectContent>
                          {g.csvTeamNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              Vorschau
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({rows.length} Spiele)
              </span>
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Zeit</TableHead>
                    <TableHead>Altersklasse</TableHead>
                    <TableHead>Heim</TableHead>
                    <TableHead>Gast</TableHead>
                    <TableHead>Nr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell>{row.match_date}</TableCell>
                      <TableCell>{row.match_time}</TableCell>
                      <TableCell>{row.age_class_raw}</TableCell>
                      <TableCell>{row.home_team}</TableCell>
                      <TableCell>{row.away_team}</TableCell>
                      <TableCell>{row.match_number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 5 && (
              <p className="text-xs text-muted-foreground">
                … und {rows.length - 5} weitere Spiele
              </p>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={loading || !allMapped}
            className="w-full sm:w-auto"
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Importiere…" : `${rows.length} Spiele importieren`}
          </Button>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-lg border bg-green-50 p-3 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.imported}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Importiert</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-blue-50 p-3 dark:bg-blue-950/20">
              <Info className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.teamsEnriched}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500">Teams angereichert</p>
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
                  <p key={i} className="py-0.5 text-sm text-muted-foreground">{s.reason}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AgeClass, Gender, AGE_CLASS_CONFIG } from "@/lib/types";

interface AgeClassTabsProps {
  gender: Gender;
  current: AgeClass;
  allowed: AgeClass[];
  clubSlug: string;
}

const ageClassLabels: Record<AgeClass, string> = {
  all: "Alle",
  "30": "30",
  "40": "40",
  "50": "50",
  "60": "60",
  u9: "U9",
  u10: "U10",
  u12: "U12",
  u15: "U15",
  u18: "U18",
};

export function AgeClassTabs({ gender, current, allowed, clubSlug }: AgeClassTabsProps) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1">
      {allowed.map((ac) => (
        <Link
          key={ac}
          href={`/${clubSlug}/players/${gender}/${ac}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            current === ac
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {ageClassLabels[ac]}
        </Link>
      ))}
    </div>
  );
}

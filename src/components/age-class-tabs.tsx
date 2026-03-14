"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AgeClass, Gender, AGE_CLASS_CONFIG } from "@/lib/types";

interface AgeClassTabsProps {
  gender: Gender;
  current: AgeClass | "overview";
  allowed: AgeClass[];
  clubSlug: string;
}

const ageClassLabels: Record<AgeClass, string> = {
  all: "00",
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

const SENIOR_CLASSES: AgeClass[] = ["all", "30", "40", "50", "60"];
const YOUTH_CLASSES: AgeClass[] = ["u9", "u10", "u12", "u15", "u18"];

function TabGroup({ items, gender, current, clubSlug }: {
  items: AgeClass[];
  gender: Gender;
  current: AgeClass | "overview";
  clubSlug: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1">
      {items.map((ac) => (
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

export function AgeClassTabs({ gender, current, allowed, clubSlug }: AgeClassTabsProps) {
  const seniorTabs = SENIOR_CLASSES.filter((ac) => allowed.includes(ac));
  const youthTabs = YOUTH_CLASSES.filter((ac) => allowed.includes(ac));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TabGroup items={seniorTabs} gender={gender} current={current} clubSlug={clubSlug} />
      <TabGroup items={youthTabs} gender={gender} current={current} clubSlug={clubSlug} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AgeClass, Gender } from "@/lib/types";

interface AgeClassTabsProps {
  gender: Gender;
  current: AgeClass;
  allowed: AgeClass[];
}

const ageClassLabels: Record<AgeClass, string> = {
  offen: "Alle",
  "30": "30",
  "40": "40",
  "50": "50",
  "60": "60",
};

function ageClassToUrl(ac: AgeClass): string {
  return ac === "offen" ? "all" : ac;
}

export function AgeClassTabs({ gender, current, allowed }: AgeClassTabsProps) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1">
      {allowed.map((ac) => (
        <Link
          key={ac}
          href={`/${gender}/${ageClassToUrl(ac)}`}
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

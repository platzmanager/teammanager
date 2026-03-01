"use client";

import { useId } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgeClass } from "@/lib/types";

interface AgeClassTabsProps {
  value: AgeClass;
  onChange: (value: AgeClass) => void;
}

const ageClasses: { value: AgeClass; label: string }[] = [
  { value: "offen", label: "Offen" },
  { value: "30", label: "30" },
  { value: "40", label: "40" },
  { value: "50", label: "50" },
  { value: "60", label: "60" },
];

export function AgeClassTabs({ value, onChange }: AgeClassTabsProps) {
  const id = useId();
  return (
    <Tabs id={id} value={value} onValueChange={(v) => onChange(v as AgeClass)}>
      <TabsList>
        {ageClasses.map((ac) => (
          <TabsTrigger key={ac.value} value={ac.value}>
            {ac.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

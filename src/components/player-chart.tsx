"use client";

import * as React from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Gender, AgeClass } from "@/lib/types";
import { getPlayerDistributions, type PlayerDistributions } from "@/actions/players";

const lkConfig = {
  value: {
    label: "Spieler",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const ageConfig = {
  value: {
    label: "Spieler",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface PlayerChartProps {
  gender: Gender;
  ageClass: AgeClass;
  minAge?: number;
  maxAge?: number;
  hideDeleted: boolean;
}

function MultiLineLabel({ x, y, payload, textAnchor }: {
  x: number;
  y: number;
  payload: { value: string };
  textAnchor: "start" | "middle" | "end" | "inherit" | undefined;
}) {
  const text = payload.value;
  // Split on space to get two lines, e.g. "Spitze" and "(1-4)"
  const parts = text.match(/^(.+?)(\s*\(.+\))$/) ?? [text, text, ""];
  return (
    <text x={x} y={y} textAnchor={textAnchor} fontSize={11}>
      <tspan x={x} dy="0">{parts[1]}</tspan>
      {parts[2] && <tspan x={x} dy="13" className="fill-muted-foreground" fontSize={10}>{parts[2].trim()}</tspan>}
    </text>
  );
}

export function PlayerChart({ gender, ageClass, minAge, maxAge, hideDeleted }: PlayerChartProps) {
  const [data, setData] = React.useState<PlayerDistributions>({
    lk: [], age: [], totalLk: 0, totalAge: 0,
  });

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getPlayerDistributions({ gender, ageClass, minAge, maxAge, hideDeleted });
      if (!cancelled) setData(result);
    }
    load();
    return () => { cancelled = true; };
  }, [gender, ageClass, minAge, maxAge, hideDeleted]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="py-0 overflow-hidden">
        <CardHeader className="px-6 pt-4 pb-0">
          <CardTitle className="text-sm">Leistungsklasse</CardTitle>
          <CardDescription className="text-xs">
            {data.totalLk} Spieler mit LK
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ChartContainer config={lkConfig} className="mx-auto aspect-square max-h-[250px]">
            <RadarChart data={data.lk} outerRadius="65%">
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarAngleAxis
                dataKey="category"
                tick={(props) => <MultiLineLabel {...props} />}
              />
              <PolarGrid gridType="circle" />
              <Radar
                dataKey="value"
                fill="var(--color-value)"
                fillOpacity={0.4}
                stroke="var(--color-value)"
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="py-0 overflow-hidden">
        <CardHeader className="px-6 pt-4 pb-0">
          <CardTitle className="text-sm">Altersverteilung</CardTitle>
          <CardDescription className="text-xs">
            {data.totalAge} Spieler gesamt
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ChartContainer config={ageConfig} className="mx-auto aspect-square max-h-[250px]">
            <RadarChart data={data.age} outerRadius="65%">
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 11 }}
              />
              <PolarGrid gridType="circle" />
              <Radar
                dataKey="value"
                fill="var(--color-value)"
                fillOpacity={0.4}
                stroke="var(--color-value)"
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface BodyTimelinePoint {
  date: string;
  weight: number | null;
  bmi: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  bodyWaterPct: number | null;
  visceralFat: number | null;
  basalMetabolism: number | null;
  bodyScore: number | null;
  metabolicAge: number | null;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-card, #1f1f1f)",
  border: "1px solid var(--color-border, #333)",
};

const LABEL_STYLE = { color: "var(--color-foreground, #fff)" };

function ChartShell({ height = 220, children }: { height?: number; children: React.ReactNode }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  );
}

export function WeightBmiChart({ data }: { data: BodyTimelinePoint[] }) {
  if (data.length === 0) return <Empty />;
  const hasBmi = data.some((d) => d.bmi != null);
  return (
    <ChartShell>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis yAxisId="weight" tick={{ fontSize: 10 }} stroke="#6b7280" unit=" kg" />
        {hasBmi && (
          <YAxis
            yAxisId="bmi"
            orientation="right"
            tick={{ fontSize: 10 }}
            stroke="#6b7280"
            domain={[15, 35]}
          />
        )}
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
        <Legend />
        <Line
          yAxisId="weight"
          type="monotone"
          dataKey="weight"
          name="Waga (kg)"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        {hasBmi && (
          <Line
            yAxisId="bmi"
            type="monotone"
            dataKey="bmi"
            name="BMI"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        )}
      </LineChart>
    </ChartShell>
  );
}

export function FatMuscleChart({ data }: { data: BodyTimelinePoint[] }) {
  if (data.length === 0 || data.every((d) => d.bodyFat == null && d.muscleMass == null))
    return <Empty />;
  return (
    <ChartShell>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis yAxisId="fat" tick={{ fontSize: 10 }} stroke="#6b7280" unit=" %" />
        <YAxis
          yAxisId="muscle"
          orientation="right"
          tick={{ fontSize: 10 }}
          stroke="#6b7280"
          unit=" kg"
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
        <Legend />
        <Line
          yAxisId="fat"
          type="monotone"
          dataKey="bodyFat"
          name="Tkanka tłuszczowa (%)"
          stroke="#fb923c"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          yAxisId="muscle"
          type="monotone"
          dataKey="muscleMass"
          name="Masa mięśniowa (kg)"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartShell>
  );
}

export function WaterVisceralChart({ data }: { data: BodyTimelinePoint[] }) {
  if (data.length === 0 || data.every((d) => d.bodyWaterPct == null && d.visceralFat == null))
    return <Empty />;
  return (
    <ChartShell>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis yAxisId="water" tick={{ fontSize: 10 }} stroke="#6b7280" unit=" %" />
        <YAxis
          yAxisId="visceral"
          orientation="right"
          tick={{ fontSize: 10 }}
          stroke="#6b7280"
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
        <Legend />
        <Line
          yAxisId="water"
          type="monotone"
          dataKey="bodyWaterPct"
          name="Woda (%)"
          stroke="#06b6d4"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          yAxisId="visceral"
          type="monotone"
          dataKey="visceralFat"
          name="Tłuszcz trzewny (idx)"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartShell>
  );
}

export function ScoreAgeChart({ data }: { data: BodyTimelinePoint[] }) {
  if (data.length === 0 || data.every((d) => d.bodyScore == null && d.metabolicAge == null))
    return <Empty />;
  return (
    <ChartShell>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis yAxisId="score" tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
        <YAxis yAxisId="age" orientation="right" tick={{ fontSize: 10 }} stroke="#6b7280" unit=" lat" />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
        <Legend />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="bodyScore"
          name="Body score"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          yAxisId="age"
          type="monotone"
          dataKey="metabolicAge"
          name="Wiek metaboliczny"
          stroke="#facc15"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartShell>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
      Brak danych
    </div>
  );
}

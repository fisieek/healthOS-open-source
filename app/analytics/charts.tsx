"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// --- Training Load Chart ---
export type TrainingLoadPoint = {
  date: string;
  rolling7d: number;
  rolling28d: number;
};

export function TrainingLoadChart({ data }: { data: TrainingLoadPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak danych</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" unit="h" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
        />
        <Legend />
        <Line type="monotone" dataKey="rolling7d" name="7 dni" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="rolling28d" name="28 dni" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// --- Weekly Distance Chart ---
export type WeeklyDistancePoint = {
  week: string;
  RUN: number;
  RIDE: number;
  SWIM: number;
};

export function WeeklyDistanceChart({ data }: { data: WeeklyDistancePoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak danych</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" unit=" km" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
        />
        <Legend />
        <Bar dataKey="RUN" name="Bieg" stackId="a" fill="#22c55e" />
        <Bar dataKey="RIDE" name="Rower" stackId="a" fill="#3b82f6" />
        <Bar dataKey="SWIM" name="Pływanie" stackId="a" fill="#06b6d4" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- Weekly Volume Chart ---
export type WeeklyVolumePoint = {
  week: string;
  volume: number;
};

export function WeeklyVolumeChart({ data }: { data: WeeklyVolumePoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak danych</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" unit=" kg" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
        />
        <Bar dataKey="volume" name="Tonaż" fill="#a855f7" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- Compliance Chart ---
export type ComplianceWeekPoint = {
  week: string;
  compliance: number;
};

export function ComplianceChart({ data }: { data: ComplianceWeekPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak danych</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" domain={[0, 100]} unit="%" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
          formatter={(value) => [`${Number(value).toFixed(0)}%`, "Compliance"]}
        />
        <Bar dataKey="compliance" fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- Body Weight Trend Chart ---
export type BodyWeightPoint = {
  date: string;
  weight: number | null;
  bmi: number | null;
};

export function BodyWeightChart({ data }: { data: BodyWeightPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak danych</p>;
  }
  const hasBmi = data.some((d) => d.bmi !== null);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis yAxisId="weight" tick={{ fontSize: 11 }} stroke="#6b7280" unit=" kg" />
        {hasBmi && <YAxis yAxisId="bmi" orientation="right" tick={{ fontSize: 11 }} stroke="#6b7280" />}
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
        />
        <Legend />
        <Line yAxisId="weight" type="monotone" dataKey="weight" name="Waga (kg)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        {hasBmi && (
          <Line yAxisId="bmi" type="monotone" dataKey="bmi" name="BMI" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// --- Weekly HR-zone distribution (stacked bars Z1-Z5) ---
export type ZoneWeekPoint = {
  week: string;
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

export function ZoneDistributionChart({ data }: { data: ZoneWeekPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak danych — wymaga streamów HR ze Stravy oraz wypełnionego profilu HR.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" unit="m" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
          formatter={(value, name) => [`${Math.round(Number(value))} min`, name as string]}
        />
        <Legend />
        <Bar dataKey="z1" name="Z1" stackId="a" fill="#60a5fa" />
        <Bar dataKey="z2" name="Z2" stackId="a" fill="#4ade80" />
        <Bar dataKey="z3" name="Z3" stackId="a" fill="#facc15" />
        <Bar dataKey="z4" name="Z4" stackId="a" fill="#fb923c" />
        <Bar dataKey="z5" name="Z5" stackId="a" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- VDOT trend (per qualifying run + EMA) ---
export type VdotPoint = {
  date: string;
  vdot: number | null;
  ema: number | null;
};

export function VdotTrendChart({ data }: { data: VdotPoint[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak biegów tempo / threshold / race do estymacji VDOT.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
          formatter={(value, name) => [Number(value).toFixed(1), name as string]}
        />
        <Legend />
        <Line type="monotone" dataKey="vdot" name="VDOT (per bieg)" stroke="#22c55e" strokeWidth={1.4} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="ema" name="Trend (EMA)" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}


// --- Body composition trend (multi-axis) ---
export type BodyCompositionPoint = {
  date: string;
  bodyFat: number | null;
  muscleMass: number | null;
  bodyWaterPct: number | null;
};

export function BodyCompositionChart({ data }: { data: BodyCompositionPoint[] }) {
  if (data.length === 0 || data.every((d) => d.bodyFat == null && d.muscleMass == null && d.bodyWaterPct == null)) {
    return <p className="text-muted-foreground text-sm">Brak danych — wgraj zdjęcie z wagi w Dzienniku.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
        <YAxis yAxisId="pct" tick={{ fontSize: 11 }} stroke="#6b7280" unit=" %" />
        <YAxis yAxisId="muscle" orientation="right" tick={{ fontSize: 11 }} stroke="#6b7280" unit=" kg" />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--color-card, #1f1f1f)", border: "1px solid var(--color-border, #333)" }}
          labelStyle={{ color: "var(--color-foreground, #fff)" }}
        />
        <Legend />
        <Line yAxisId="pct" type="monotone" dataKey="bodyFat" name="Tłuszcz (%)" stroke="#fb923c" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line yAxisId="pct" type="monotone" dataKey="bodyWaterPct" name="Woda (%)" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line yAxisId="muscle" type="monotone" dataKey="muscleMass" name="Mięśnie (kg)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

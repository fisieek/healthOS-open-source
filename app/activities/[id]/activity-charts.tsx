"use client";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import type { ZoneDef } from "@/lib/services/zones";

interface StreamPoint {
  t: number; // seconds since start
  hr?: number | null;
  pace?: number | null; // s/km
  speed?: number | null; // m/s (for cycling)
  alt?: number | null;
  cadence?: number | null;
  watts?: number | null;
  temp?: number | null;
}

export interface ActivityChartsProps {
  points: StreamPoint[];
  zones: ZoneDef[] | null;
  isCycling: boolean;
}

const ZONE_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#60a5fa", // blue-400
  2: "#4ade80", // green-400
  3: "#facc15", // yellow-400
  4: "#fb923c", // orange-400
  5: "#ef4444", // red-500
};

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPace(spk: number): string {
  if (!Number.isFinite(spk) || spk <= 0) return "—";
  const m = Math.floor(spk / 60);
  const s = Math.floor(spk % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function fmtSpeed(mps: number): string {
  if (!Number.isFinite(mps) || mps < 0) return "—";
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

interface ChartShellProps {
  title: string;
  unit?: string;
  height?: number;
  children: React.ReactNode;
}

function ChartShell({ title, unit, height = 160, children }: ChartShellProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
          {title}
        </h3>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  );
}

export function ActivityCharts({ points, zones, isCycling }: ActivityChartsProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
        Brak danych ze streamów (HR, tempo, elewacja). Uruchom backfill na stronie ustawień.
      </div>
    );
  }

  const hasHr = points.some((p) => p.hr != null);
  const hasPace = points.some((p) => p.pace != null);
  const hasSpeed = points.some((p) => p.speed != null);
  const hasAlt = points.some((p) => p.alt != null);
  const hasCadence = points.some((p) => p.cadence != null);
  const hasWatts = points.some((p) => p.watts != null);
  const hasTemp = points.some((p) => p.temp != null);

  // Compute HR axis bounds for reference areas
  let hrMin = 60;
  let hrMax = 200;
  if (hasHr) {
    const vals = points.map((p) => p.hr).filter((v): v is number => v != null);
    hrMin = Math.max(40, Math.min(...vals) - 10);
    hrMax = Math.min(220, Math.max(...vals) + 10);
  }

  return (
    <div className="space-y-3">
      {/* HR with zone bands */}
      {hasHr && (
        <ChartShell title="Tętno + strefy" unit="bpm">
          <AreaChart
            data={points}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
            {zones?.map((z) => (
              <ReferenceArea
                key={z.id}
                y1={z.low}
                y2={z.high}
                fill={ZONE_COLORS[z.id]}
                fillOpacity={0.06}
                stroke="none"
              />
            ))}
            <XAxis
              dataKey="t"
              tickFormatter={fmtTime}
              tick={{ fontSize: 10 }}
              minTickGap={40}
            />
            <YAxis
              domain={[hrMin, hrMax]}
              tick={{ fontSize: 10 }}
              width={36}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
              }}
              labelFormatter={(t) => fmtTime(Number(t))}
              formatter={(value) => [`${value} bpm`, "HR"]}
            />
            <Area
              type="monotone"
              dataKey="hr"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.15}
              strokeWidth={1.4}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ChartShell>
      )}

      {/* Pace (running) — pace is reversed: lower s/km = faster, so we invert Y */}
      {hasPace && !isCycling && (
        <ChartShell title="Tempo" unit="min/km">
          <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
            <XAxis
              dataKey="t"
              tickFormatter={fmtTime}
              tick={{ fontSize: 10 }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={48}
              tickFormatter={(v) => fmtPace(v)}
              reversed
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
              }}
              labelFormatter={(t) => fmtTime(Number(t))}
              formatter={(value) => [fmtPace(Number(value)), "Tempo"]}
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke="#22c55e"
              dot={false}
              strokeWidth={1.4}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ChartShell>
      )}

      {/* Speed (cycling) */}
      {hasSpeed && isCycling && (
        <ChartShell title="Prędkość" unit="km/h">
          <AreaChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
            <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fontSize: 10 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
              }}
              labelFormatter={(t) => fmtTime(Number(t))}
              formatter={(value) => [fmtSpeed(Number(value)), "Prędkość"]}
            />
            <Area
              type="monotone"
              dataKey="speed"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={1.4}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ChartShell>
      )}

      {/* Elevation profile */}
      {hasAlt && (
        <ChartShell title="Elewacja" unit="m">
          <AreaChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
            <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fontSize: 10 }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
              }}
              labelFormatter={(t) => fmtTime(Number(t))}
              formatter={(value) => [`${Math.round(Number(value))} m`, "Wysokość"]}
            />
            <Area
              type="monotone"
              dataKey="alt"
              stroke="#737373"
              fill="#737373"
              fillOpacity={0.2}
              strokeWidth={1}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ChartShell>
      )}

      {/* Cadence + Watts mini-row */}
      {(hasCadence || hasWatts || hasTemp) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hasCadence && (
            <ChartShell title="Kadencja" unit={isCycling ? "rpm" : "spm"} height={120}>
              <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                  labelFormatter={(t) => fmtTime(Number(t))}
                />
                <Line
                  type="monotone"
                  dataKey="cadence"
                  stroke="#a855f7"
                  dot={false}
                  strokeWidth={1.2}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ChartShell>
          )}

          {hasWatts && (
            <ChartShell title="Moc" unit="W" height={120}>
              <AreaChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                  labelFormatter={(t) => fmtTime(Number(t))}
                />
                <Area
                  type="monotone"
                  dataKey="watts"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.15}
                  strokeWidth={1.2}
                  isAnimationActive={false}
                  connectNulls
                />
              </AreaChart>
            </ChartShell>
          )}

          {hasTemp && (
            <ChartShell title="Temperatura" unit="°C" height={120}>
              <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                  labelFormatter={(t) => fmtTime(Number(t))}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={1.2}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ChartShell>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import {
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export interface BodyTimelinePoint {
  date: Date;
  dateStr: string;
  weight: number | null;
  bmi: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
  bodyWaterPct: number | null;
  visceralFat: number | null;
  boneMass: number | null;
}

export const TOOLTIP_STYLE = {
  backgroundColor: "#1a1c18",
  border: "1px solid #2e3229",
  borderRadius: "8px",
};

export const LABEL_STYLE = { color: "#f1f2ec" };

export function CombinedBodyChart({ data }: { data: BodyTimelinePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-xs text-muted-foreground bg-[#1a1c18] border border-[#2e3229] rounded-xl">
        Brak danych z wybranego okresu
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    displayDate: format(d.date, "dd.MM.yy", { locale: pl }),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={formattedData} margin={{ top: 15, right: 10, bottom: 5, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
        <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: "#8c9282" }} stroke="#2e3229" />
        <YAxis 
          yAxisId="kg" 
          tick={{ fontSize: 10, fill: "#8c9282" }} 
          stroke="#2e3229" 
          unit=" kg" 
          domain={["dataMin - 3", "dataMax + 3"]}
        />
        <YAxis
          yAxisId="percent"
          orientation="right"
          tick={{ fontSize: 10, fill: "#8c9282" }}
          stroke="#2e3229"
          unit=" %"
          domain={["dataMin - 2", "dataMax + 2"]}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
        
        <Line
          yAxisId="kg"
          type="monotone"
          dataKey="weight"
          name="Waga (kg)"
          stroke="#bce663" // Premium Neon Green
          strokeWidth={3}
          dot={{ r: 4, stroke: "#0d0e0c", strokeWidth: 2, fill: "#bce663" }}
          activeDot={{ r: 6 }}
          connectNulls
        />
        <Line
          yAxisId="percent"
          type="monotone"
          dataKey="bodyFat"
          name="Tłuszcz (%)"
          stroke="#ff9800" // Accent Orange
          strokeWidth={2}
          dot={{ r: 3, stroke: "#0d0e0c", strokeWidth: 1.5, fill: "#ff9800" }}
          connectNulls
        />
        <Line
          yAxisId="kg"
          type="monotone"
          dataKey="muscleMass"
          name="Mięśnie (kg)"
          stroke="#4dc9f6" // Accent Blue
          strokeWidth={2}
          dot={{ r: 3, stroke: "#0d0e0c", strokeWidth: 1.5, fill: "#4dc9f6" }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Parameter Trend Chart (single or dual metric) ────────────────────────────

export interface ParameterTrendChartProps {
  measurements: any[];
  primaryKey: string;
  primaryLabel: string;
  primaryUnit: string;
  primaryColor: string;
  secondaryKey?: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  secondaryColor?: string;
  decimals?: number;
  secondaryDecimals?: number;
  goodWhenUp?: boolean;
  secondaryGoodWhenUp?: boolean;
  icon: React.ReactNode;
}

export function ParameterTrendChart({
  measurements,
  primaryKey,
  primaryLabel,
  primaryUnit,
  primaryColor,
  secondaryKey,
  secondaryLabel,
  secondaryUnit,
  secondaryColor,
  decimals = 1,
  secondaryDecimals = 1,
  goodWhenUp = true,
  secondaryGoodWhenUp = true,
  icon,
}: ParameterTrendChartProps) {
  // Sort chronologically (measurements come desc from DB)
  const sorted = [...measurements].reverse();
  const isDual = !!secondaryKey;

  const chartData = sorted
    .filter((m) => m[primaryKey] != null)
    .map((m) => ({
      displayDate: format(new Date(m.date), "dd.MM.yy", { locale: pl }),
      [primaryKey]: m[primaryKey],
      ...(secondaryKey ? { [secondaryKey]: m[secondaryKey] } : {}),
    }));

  if (chartData.length === 0) {
    return (
      <div className="bg-[#1a1c18] border border-[#2e3229] rounded-xl p-4">
        <div className="flex items-center gap-2 text-[#8c9282] text-xs">
          {icon}
          <span>{primaryLabel}</span>
        </div>
        <p className="text-[10px] text-[#5d6050] mt-2">Brak danych</p>
      </div>
    );
  }

  // Current & previous values
  const latest = measurements[0]; // desc order, so [0] is newest
  const prev = measurements[1];

  const currentVal = latest?.[primaryKey];
  const prevVal = prev?.[primaryKey];
  const delta = currentVal != null && prevVal != null ? currentVal - prevVal : null;

  const currentSecVal = secondaryKey ? latest?.[secondaryKey] : null;
  const prevSecVal = secondaryKey ? prev?.[secondaryKey] : null;
  const deltaSec = currentSecVal != null && prevSecVal != null ? currentSecVal - prevSecVal : null;

  const formatDelta = (d: number, dec: number, unit: string, isGoodUp: boolean) => {
    const isGood = isGoodUp ? d > 0 : d < 0;
    const cls = d === 0
      ? "bg-[#2e3229] text-[#8c9282] border-[#2e3229]"
      : isGood
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-orange-500/10 text-orange-400 border-orange-500/20";
    const prefix = d > 0 ? "+" : "";
    return (
      <Badge className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md border ${cls}`}>
        {prefix}{d.toFixed(dec)}{unit}
      </Badge>
    );
  };

  const gradientId = `grad-${primaryKey}`;
  const gradientSecId = secondaryKey ? `grad-${secondaryKey}` : "";

  return (
    <div className="bg-[#1a1c18] border border-[#2e3229] rounded-xl overflow-hidden transition-all hover:border-[#bce663]/30">
      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#bce663] shrink-0">
              {icon}
            </div>
            <div>
              <p className="text-[10px] text-[#8c9282] uppercase tracking-wider font-semibold">
                {isDual ? `${primaryLabel} + ${secondaryLabel}` : primaryLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Primary current value + delta */}
            {currentVal != null && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono font-bold" style={{ color: primaryColor }}>
                  {currentVal.toFixed(decimals)}
                  <span className="text-[10px] font-normal text-[#8c9282]">{primaryUnit}</span>
                </span>
                {delta != null && delta !== 0 && formatDelta(delta, decimals, primaryUnit, goodWhenUp)}
              </div>
            )}
            {/* Secondary current value + delta */}
            {isDual && currentSecVal != null && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#2e3229]">
                <span className="text-sm font-mono font-bold" style={{ color: secondaryColor }}>
                  {currentSecVal.toFixed(secondaryDecimals)}
                  <span className="text-[10px] font-normal text-[#8c9282]">{secondaryUnit}</span>
                </span>
                {deltaSec != null && deltaSec !== 0 && formatDelta(deltaSec, secondaryDecimals, secondaryUnit ?? "", secondaryGoodWhenUp)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-2">
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={chartData} margin={{ top: 5, right: isDual ? 5 : 15, bottom: 0, left: -15 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
              </linearGradient>
              {isDual && (
                <linearGradient id={gradientSecId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 9, fill: "#5d6050" }}
              stroke="#2e3229"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="primary"
              tick={{ fontSize: 9, fill: "#5d6050" }}
              stroke="transparent"
              tickLine={false}
              axisLine={false}
              domain={["dataMin - 1", "dataMax + 1"]}
              width={35}
            />
            {isDual && (
              <YAxis
                yAxisId="secondary"
                orientation="right"
                tick={{ fontSize: 9, fill: "#5d6050" }}
                stroke="transparent"
                tickLine={false}
                axisLine={false}
                domain={["dataMin - 1", "dataMax + 1"]}
                width={35}
              />
            )}
            <Tooltip
              contentStyle={{
                ...TOOLTIP_STYLE,
                fontSize: "11px",
                padding: "8px 12px",
              }}
              labelStyle={{ ...LABEL_STYLE, fontSize: "10px", marginBottom: "4px" }}
            />
            {/* Primary line + area */}
            <Area
              yAxisId="primary"
              type="monotone"
              dataKey={primaryKey}
              name={primaryLabel}
              stroke="transparent"
              fill={`url(#${gradientId})`}
              connectNulls
            />
            <Line
              yAxisId="primary"
              type="monotone"
              dataKey={primaryKey}
              name={`${primaryLabel} (${primaryUnit.trim()})`}
              stroke={primaryColor}
              strokeWidth={2.5}
              dot={{ r: 3, stroke: "#0d0e0c", strokeWidth: 2, fill: primaryColor }}
              activeDot={{ r: 5, stroke: primaryColor, strokeWidth: 2, fill: "#0d0e0c" }}
              connectNulls
            />
            {/* Secondary line + area */}
            {isDual && secondaryKey && (
              <>
                <Area
                  yAxisId="secondary"
                  type="monotone"
                  dataKey={secondaryKey}
                  name={secondaryLabel}
                  stroke="transparent"
                  fill={`url(#${gradientSecId})`}
                  connectNulls
                />
                <Line
                  yAxisId="secondary"
                  type="monotone"
                  dataKey={secondaryKey}
                  name={`${secondaryLabel} (${secondaryUnit?.trim()})`}
                  stroke={secondaryColor}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 2.5, stroke: "#0d0e0c", strokeWidth: 1.5, fill: secondaryColor }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

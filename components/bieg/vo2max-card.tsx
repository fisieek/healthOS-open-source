import React from "react";
import { Activity } from "lucide-react";
import { Vo2maxPoint } from "@/lib/services/running-stats";

interface Vo2maxCardProps {
  currentVdot: number | null;
  trendPoints: Vo2maxPoint[];
  birthDate: Date | null;
  gender: string | null;
}

/**
 * Returns fitness classification based on VO2max, age, and gender
 */
function getFitnessLevel(vo2max: number, age: number | null, gender: string | null): { level: string; color: string } {
  if (!vo2max) return { level: "Brak danych", color: "text-zinc-500" };
  const actualAge = age ?? 30; // default to 30
  const isMale = !gender || gender.toLowerCase() === "male" || gender.toLowerCase() === "m" || gender.toLowerCase() === "mężczyzna";

  if (isMale) {
    if (actualAge < 30) {
      if (vo2max >= 52.4) return { level: "Doskonała (Elite)", color: "text-[#bce663]" };
      if (vo2max >= 46.5) return { level: "Dobra", color: "text-emerald-400" };
      if (vo2max >= 42.5) return { level: "Przeciętna", color: "text-sky-400" };
      return { level: "Słaba", color: "text-rose-400" };
    } else if (actualAge < 40) {
      if (vo2max >= 49.4) return { level: "Doskonała (Elite)", color: "text-[#bce663]" };
      if (vo2max >= 44.0) return { level: "Dobra", color: "text-emerald-400" };
      if (vo2max >= 40.0) return { level: "Przeciętna", color: "text-sky-400" };
      return { level: "Słaba", color: "text-rose-400" };
    } else {
      if (vo2max >= 46.5) return { level: "Doskonała (Elite)", color: "text-[#bce663]" };
      if (vo2max >= 41.0) return { level: "Dobra", color: "text-emerald-400" };
      if (vo2max >= 37.0) return { level: "Przeciętna", color: "text-sky-400" };
      return { level: "Słaba", color: "text-rose-400" };
    }
  } else {
    // Female
    if (actualAge < 30) {
      if (vo2max >= 46.9) return { level: "Doskonała (Elite)", color: "text-[#bce663]" };
      if (vo2max >= 41.0) return { level: "Dobra", color: "text-emerald-400" };
      if (vo2max >= 36.0) return { level: "Przeciętna", color: "text-sky-400" };
      return { level: "Słaba", color: "text-rose-400" };
    } else if (actualAge < 40) {
      if (vo2max >= 44.9) return { level: "Doskonała (Elite)", color: "text-[#bce663]" };
      if (vo2max >= 39.0) return { level: "Dobra", color: "text-emerald-400" };
      if (vo2max >= 34.0) return { level: "Przeciętna", color: "text-sky-400" };
      return { level: "Słaba", color: "text-rose-400" };
    } else {
      if (vo2max >= 42.0) return { level: "Doskonała (Elite)", color: "text-[#bce663]" };
      if (vo2max >= 36.0) return { level: "Dobra", color: "text-emerald-400" };
      if (vo2max >= 32.0) return { level: "Przeciętna", color: "text-sky-400" };
      return { level: "Słaba", color: "text-rose-400" };
    }
  }
}

export default function Vo2maxCard({ currentVdot, trendPoints, birthDate, gender }: Vo2maxCardProps) {
  // Compute age
  let age: number | null = null;
  if (birthDate) {
    const today = new Date();
    age = today.getFullYear() - new Date(birthDate).getFullYear();
    const m = today.getMonth() - new Date(birthDate).getMonth();
    if (m < 0 || (m === 0 && today.getDate() < new Date(birthDate).getDate())) {
      age--;
    }
  }

  const vdotVal = currentVdot ?? 45.0; // Fallback value
  const fitness = getFitnessLevel(vdotVal, age, gender);

  // SVG Sparkline calculation
  const width = 160;
  const height = 48;
  const padding = 4;

  let sparklinePoints = "";
  if (trendPoints.length > 1) {
    const vdots = trendPoints.map((p) => p.vdot);
    const minV = Math.min(...vdots) - 1;
    const maxV = Math.max(...vdots) + 1;
    const range = maxV - minV || 1;

    sparklinePoints = trendPoints
      .map((p, index) => {
        const x = padding + (index / (trendPoints.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((p.vdot - minV) / range) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 flex flex-col justify-between hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#bce663]/5 blur-[60px] rounded-full group-hover:bg-[#bce663]/10 transition-all duration-300" />

      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium">Szacowany VDOT / VO₂max</span>
          <div className="flex items-baseline mt-2">
            <span className="text-4xl font-extrabold font-mono tracking-tight text-white">{vdotVal.toFixed(1)}</span>
            <span className="text-xs text-zinc-500 ml-2 font-mono">ml/kg/min</span>
          </div>
        </div>
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Activity className="h-5 w-5 text-[#bce663]" />
        </div>
      </div>

      <div className="flex justify-between items-end mt-6">
        <div>
          <div className="text-xs text-zinc-500">Klasa sprawności</div>
          <div className={`text-sm font-bold ${fitness.color} mt-0.5`}>{fitness.level}</div>
        </div>

        {/* Sparkline chart */}
        {trendPoints.length > 1 ? (
          <div className="flex flex-col items-end">
            <svg width={width} height={height} className="overflow-visible">
              {/* Gradient below line */}
              <defs>
                <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bce663" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#bce663" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Area path */}
              <path
                d={`M ${padding},${height} L ${sparklinePoints} L ${width - padding},${height} Z`}
                fill="url(#sparklineGrad)"
              />
              {/* Line path */}
              <polyline
                fill="none"
                stroke="#bce663"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
              {/* Pulse point for the last value */}
              {trendPoints.length > 0 && (
                <circle
                  cx={padding + (width - 2 * padding)}
                  cy={
                    height -
                    padding -
                    ((trendPoints[trendPoints.length - 1].vdot - Math.min(...trendPoints.map((p) => p.vdot)) + 1) /
                      (Math.max(...trendPoints.map((p) => p.vdot)) - Math.min(...trendPoints.map((p) => p.vdot)) + 2)) *
                      (height - 2 * padding)
                  }
                  r="3.5"
                  fill="#bce663"
                  className="animate-pulse"
                />
              )}
            </svg>
            <span className="text-[10px] text-zinc-500 mt-1 font-mono">Trend 12 tygodni</span>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 font-mono italic">Wymagane więcej biegów do trendu</div>
        )}
      </div>
    </div>
  );
}

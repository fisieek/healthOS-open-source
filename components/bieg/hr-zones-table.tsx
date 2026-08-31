import React from "react";
import { Heart } from "lucide-react";
import { HrZonesSummary } from "@/lib/services/running-stats";
import { ZoneDef } from "@/lib/services/zones";

interface HrZonesTableProps {
  summary: HrZonesSummary;
  zones: ZoneDef[] | null;
}

const ZONE_COLORS = {
  1: { bg: "bg-zinc-600", text: "text-zinc-400", border: "border-zinc-700/80" },
  2: { bg: "bg-sky-500", text: "text-sky-400", border: "border-sky-950/80" },
  3: { bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-950/80" },
  4: { bg: "bg-amber-500", text: "text-amber-400", border: "border-amber-950/80" },
  5: { bg: "bg-rose-500", text: "text-rose-400", border: "border-rose-950/80" },
};

export default function HrZonesTable({ summary, zones }: HrZonesTableProps) {
  const totalMin = summary.total || 1; // avoid division by zero

  // Prepare standard 5 zones if none provided
  const zoneDefinitions = zones || [
    { id: 1, label: "Z1 — Recovery", low: 96, high: 115, description: "Bardzo lekko, regeneracja" },
    { id: 2, label: "Z2 — Easy", low: 115, high: 134, description: "Trening tlenowy, baza" },
    { id: 3, label: "Z3 — Steady", low: 134, high: 153, description: "Tempo umiarkowane" },
    { id: 4, label: "Z4 — Threshold", low: 153, high: 172, description: "Próg mleczanowy" },
    { id: 5, label: "Z5 — VO2max", low: 172, high: 192, description: "Maksimum, interwały" },
  ];

  const getMinutesForZone = (id: number): number => {
    if (id === 1) return summary.z1;
    if (id === 2) return summary.z2;
    if (id === 3) return summary.z3;
    if (id === 4) return summary.z4;
    return summary.z5;
  };

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Strefy Tętna (Ostatnie 7 dni)</h3>
          <p className="text-xs text-zinc-500 mt-1">Rozkład czasu spędzonego w strefach intensywności</p>
        </div>
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Heart className="h-5 w-5 text-rose-500 animate-pulse" />
        </div>
      </div>

      {/* Zones list */}
      <div className="space-y-4 flex-grow flex flex-col justify-around">
        {zoneDefinitions.map((z) => {
          const zoneMin = getMinutesForZone(z.id);
          const percent = Math.round((zoneMin / totalMin) * 100);
          const colors = ZONE_COLORS[z.id as 1 | 2 | 3 | 4 | 5];

          return (
            <div key={z.id} className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline text-xs">
                {/* Zone Label & Bounds */}
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${colors.text}`}>{z.label}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({z.low} - {z.high - 1} bpm)
                  </span>
                </div>
                {/* Minutes and share */}
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-white font-bold">{zoneMin} min</span>
                  <span className="text-zinc-500 text-[10px]">({percent}%)</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-zinc-900 border border-zinc-850 rounded-full overflow-hidden p-[1px]">
                <div
                  className={`h-full ${colors.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${percent || 0}%` }}
                />
              </div>

              {/* Description */}
              <span className="text-[10px] text-zinc-500 mt-0.5">{z.description}</span>
            </div>
          );
        })}
      </div>

      {/* Footer sum */}
      <div className="mt-6 pt-4 border-t border-zinc-800/60 flex justify-between items-center text-xs text-zinc-400 font-mono">
        <span>Łączny czas tętna:</span>
        <span className="text-white font-bold">{summary.total} min</span>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Activity as PrismaActivity, IntensityClass } from "@/app/generated/prisma/client";
import { MapPin, ChevronDown, ChevronUp, Clock, Flame, ShieldAlert, Heart, Calendar } from "lucide-react";
import { decodePolyline, projectToSvg } from "@/lib/services/polyline";

// Typ rozszerzony aktywności
interface RunningActivity extends PrismaActivity {
  zoneMinutes: any; // { z1, z2, z3, z4, z5, total }
}

interface RunHistoryProps {
  activities: RunningActivity[];
}

const INTENSITY_LABELS: Record<IntensityClass, { label: string; bg: string; text: string }> = {
  RECOVERY: { label: "Regeneracyjny", bg: "bg-zinc-800", text: "text-zinc-400" },
  EASY: { label: "Spokojny", bg: "bg-sky-950/60", text: "text-sky-400" },
  STEADY: { label: "Steady", bg: "bg-emerald-950/60", text: "text-emerald-400" },
  TEMPO: { label: "Tempo", bg: "bg-amber-950/60", text: "text-amber-400" },
  THRESHOLD: { label: "Progowy", bg: "bg-orange-950/60", text: "text-orange-400" },
  INTERVAL: { label: "Interwały", bg: "bg-rose-950/60", text: "text-rose-400" },
  LONG: { label: "Długi bieg", bg: "bg-indigo-950/60", text: "text-indigo-400" },
  RACE: { label: "Zawody", bg: "bg-[#bce663]/10", text: "text-[#bce663]" },
  OTHER: { label: "Inny", bg: "bg-zinc-900", text: "text-zinc-400" },
};

const HR_ZONE_COLORS = {
  z1: "bg-zinc-500",
  z2: "bg-sky-500",
  z3: "bg-emerald-500",
  z4: "bg-amber-500",
  z5: "bg-rose-500",
};

const HR_ZONE_LABELS = {
  z1: "Z1 Recovery",
  z2: "Z2 Easy",
  z3: "Z3 Steady",
  z4: "Z4 Threshold",
  z5: "Z5 VO2max",
};

export default function RunHistory({ activities }: RunHistoryProps) {
  const [filter, setFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    if (filter === "ALL") return true;
    return act.intensityClass === filter;
  });

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
  }

  function formatDistance(meters: number | null): string {
    if (!meters) return "0.0 km";
    return `${(meters / 1000).toFixed(2)} km`;
  }

  function formatPace(secondsPerKm: number | null): string {
    if (!secondsPerKm) return "--:--";
    const m = Math.floor(secondsPerKm / 60);
    const s = Math.round(secondsPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")} /km`;
  }

  // Render static SVG route path from polyline
  function renderSvgMap(polyline: string | null) {
    if (!polyline) return null;
    const coords = decodePolyline(polyline);
    if (coords.length === 0) return null;

    const width = 160;
    const height = 160;
    const padding = 12;
    const { points } = projectToSvg(coords, width, height, padding);

    if (points.length < 2) return null;

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const startPoint = points[0];
    const endPoint = points[points.length - 1];

    return (
      <div className="relative w-40 h-40 bg-zinc-905 border border-zinc-800/80 rounded-xl overflow-hidden flex items-center justify-center p-2 group-hover:border-zinc-700/80 transition-colors">
        <svg width={width} height={height} className="overflow-visible">
          {/* Path */}
          <path
            d={pathD}
            fill="none"
            stroke="#bce663"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_2px_8px_rgba(188,230,99,0.4)]"
          />
          {/* Start (Green Dot) */}
          <circle cx={startPoint.x} cy={startPoint.y} r="5" fill="#10b981" stroke="#000" strokeWidth="1.5" />
          {/* End (Red Dot) */}
          <circle cx={endPoint.x} cy={endPoint.y} r="5" fill="#ef4444" stroke="#000" strokeWidth="1.5" />
        </svg>
        <span className="absolute bottom-1 right-2 text-[9px] text-zinc-500 font-mono">Trasa GPS</span>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group">
      {/* Header and filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Historia Biegów</h3>
          <p className="text-xs text-zinc-500 mt-1">Zestawienie Twoich ostatnich treningów biegowych</p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1.5 bg-zinc-900 border border-zinc-850 p-1 rounded-xl">
          {["ALL", "EASY", "TEMPO", "THRESHOLD", "INTERVAL", "LONG"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1.5 rounded-lg transition-all ${
                filter === t
                  ? "bg-zinc-800 text-[#bce663] border border-zinc-700/60"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-850"
              }`}
            >
              {t === "ALL" ? "Wszystkie" : t}
            </button>
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
              <th className="py-3 px-4">Data</th>
              <th className="py-3 px-4">Nazwa treningu</th>
              <th className="py-3 px-4">Dystans</th>
              <th className="py-3 px-4">Czas</th>
              <th className="py-3 px-4">Śr. Tempo</th>
              <th className="py-3 px-4">Śr. Tętno</th>
              <th className="py-3 px-4 text-center">VDOT</th>
              <th className="py-3 px-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filteredActivities.length > 0 ? (
              filteredActivities.map((act) => {
                const isExpanded = expandedId === act.id;
                const intClass = act.intensityClass ? INTENSITY_LABELS[act.intensityClass] : null;

                const rawZm = act.zoneMinutes;
                let zm = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, total: 1 };
                if (rawZm && typeof rawZm === "object") {
                  zm = {
                    z1: (rawZm as any).z1 || 0,
                    z2: (rawZm as any).z2 || 0,
                    z3: (rawZm as any).z3 || 0,
                    z4: (rawZm as any).z4 || 0,
                    z5: (rawZm as any).z5 || 0,
                    total: (rawZm as any).total || 1,
                  };
                }

                return (
                  <React.Fragment key={act.id}>
                    <tr
                      onClick={() => toggleExpand(act.id)}
                      className={`border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors cursor-pointer group/row ${
                        isExpanded ? "bg-zinc-900/30" : ""
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs font-mono text-zinc-400">
                        {act.startedAt.toLocaleDateString("pl-PL", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      {/* Name */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-white">
                        <div className="flex flex-col gap-1">
                          <span className="group-hover/row:text-[#bce663] transition-colors">{act.name}</span>
                          {intClass && (
                            <span
                              className={`text-[9px] uppercase tracking-wide font-black px-1.5 py-0.5 rounded w-max ${intClass.bg} ${intClass.text}`}
                            >
                              {intClass.label}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Distance */}
                      <td className="py-3.5 px-4 text-xs font-bold font-mono text-white">
                        {formatDistance(act.distance)}
                      </td>
                      {/* Duration */}
                      <td className="py-3.5 px-4 text-xs font-mono text-zinc-300">
                        {formatDuration(act.duration)}
                      </td>
                      {/* Avg Pace */}
                      <td className="py-3.5 px-4 text-xs font-mono text-zinc-300">
                        {formatPace(act.avgPace)}
                      </td>
                      {/* Avg HR */}
                      <td className="py-3.5 px-4 text-xs font-mono text-zinc-400">
                        {act.avgHr ? (
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3 text-rose-500 fill-rose-500/20" />
                            {act.avgHr} bpm
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      {/* VDOT */}
                      <td className="py-3.5 px-4 text-xs font-bold font-mono text-center text-[#bce663]">
                        {act.vdotEstimate ? act.vdotEstimate.toFixed(1) : "--"}
                      </td>
                      {/* Expand Chevron */}
                      <td className="py-3.5 px-4 text-center">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500 group-hover/row:text-[#bce663] transition-colors" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr className="bg-zinc-900/20 border-b border-zinc-800/40">
                        <td colSpan={8} className="py-4 px-6">
                          <div className="flex flex-col md:flex-row gap-6">
                            {/* Route SVG Map */}
                            {act.mapSummaryPolyline ? (
                              <div className="flex-shrink-0 flex justify-center">
                                {renderSvgMap(act.mapSummaryPolyline)}
                              </div>
                            ) : (
                              <div className="w-40 h-40 bg-zinc-900/40 border border-zinc-800/40 border-dashed rounded-xl flex flex-col items-center justify-center text-zinc-600 gap-1.5">
                                <Clock className="h-6 w-6" />
                                <span className="text-[10px] font-mono">Brak trasy GPS</span>
                              </div>
                            )}

                            {/* Stats details & HR zones */}
                            <div className="flex-grow space-y-4">
                              {/* description/notes */}
                              {act.description && (
                                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3 rounded-xl text-xs text-zinc-400 italic">
                                  {act.description}
                                </div>
                              )}

                              {/* Heart rate zones layout */}
                              <div>
                                <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">
                                  Podział Stref Tętna w tym Biegu
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                                  {(["z1", "z2", "z3", "z4", "z5"] as const).map((key) => {
                                    const min = zm[key];
                                    const pct = Math.round((min / (zm.total || 1)) * 100);
                                    const color = HR_ZONE_COLORS[key];
                                    const label = HR_ZONE_LABELS[key];

                                    return (
                                      <div
                                        key={key}
                                        className="bg-zinc-900/40 border border-zinc-850 p-2.5 rounded-lg flex flex-col justify-between"
                                      >
                                        <span className="text-[9px] font-bold text-zinc-500">{label}</span>
                                        <div className="flex justify-between items-baseline mt-2">
                                          <span className="text-sm font-mono font-bold text-white">{min} min</span>
                                          <span className="text-[9px] text-zinc-500 font-mono">({pct}%)</span>
                                        </div>
                                        <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden mt-1.5">
                                          <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Metryki uzupełniające */}
                              <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-400 pt-1 border-t border-zinc-800/30">
                                {act.maxHr && (
                                  <span>
                                    Max HR: <strong className="text-zinc-200">{act.maxHr} bpm</strong>
                                  </span>
                                )}
                                {act.elevGain && (
                                  <span>
                                    Wzniesienie: <strong className="text-zinc-200">+{act.elevGain} m</strong>
                                  </span>
                                )}
                                {act.calories && (
                                  <span>
                                    Kalorie: <strong className="text-zinc-200">{act.calories} kcal</strong>
                                  </span>
                                )}
                                {act.deviceName && (
                                  <span>
                                    Urządzenie: <strong className="text-zinc-200">{act.deviceName}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-zinc-500 italic">
                  Brak biegów w wybranej kategorii
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { Activity, Bike, Dumbbell, RefreshCw, Ruler } from "lucide-react";
import Link from "next/link";

interface ActivityItem {
  type: "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "OTHER";
  distance: number | null;
  duration: number;
  startedAt: string | Date;
}

interface StatsPanelProps {
  activities: ActivityItem[];
  lastSync: {
    status: string;
    createdAt: string | Date;
    triggeredBy: string;
  } | null;
  latestMeasurement?: {
    weight: number | null;
    bodyFat: number | null;
    date: string | Date;
  } | null;
  latestRestingHr?: {
    bpm: number;
    recordedAt: string | Date;
  } | null;
}

export default function StatsPanel({ activities, lastSync, latestMeasurement }: StatsPanelProps) {
  const runs = activities.filter(a => a.type === "RUN");
  const rides = activities.filter(a => a.type === "RIDE");
  const strengths = activities.filter(a => a.type === "STRENGTH");

  const runDist = runs.reduce((acc, curr) => acc + (curr.distance || 0), 0) / 1000;
  const rideDist = rides.reduce((acc, curr) => acc + (curr.distance || 0), 0) / 1000;
  const strengthCount = strengths.length;
  const runCount = runs.length;
  const rideCount = rides.length;

  const formatLastSync = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
  };

  const tiles = [
    {
      label: "Bieganie",
      icon: <Activity className="h-5 w-5" />,
      iconBg: "bg-lime-500/10 border-lime-500/20",
      iconColor: "text-[#bce663]",
      value: runDist.toFixed(1),
      unit: "km",
      sub: `${runCount} ${runCount === 1 ? "sesja" : runCount < 5 ? "sesje" : "sesji"} · ten tydzień`,
      href: "/bieg",
    },
    {
      label: "Rower",
      icon: <Bike className="h-5 w-5" />,
      iconBg: "bg-sky-500/10 border-sky-500/20",
      iconColor: "text-sky-400",
      value: rideDist.toFixed(1),
      unit: "km",
      sub: `${rideCount} ${rideCount === 1 ? "sesja" : rideCount < 5 ? "sesje" : "sesji"} · ten tydzień`,
      href: "/bieg",
    },
    {
      label: "Siła",
      icon: <Dumbbell className="h-5 w-5" />,
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
      value: String(strengthCount),
      unit: strengthCount === 1 ? "sesja" : strengthCount < 5 ? "sesje" : "sesji",
      sub: "ten tydzień",
      href: "/strength",
    },
    {
      label: "Pomiar sylwetki",
      icon: <Ruler className="h-5 w-5" />,
      iconBg: "bg-violet-500/10 border-violet-500/20",
      iconColor: "text-violet-400",
      value: latestMeasurement ? formatDate(latestMeasurement.date) : "—",
      unit: "",
      sub: latestMeasurement?.weight != null
        ? `${latestMeasurement.weight.toFixed(1)} kg${latestMeasurement.bodyFat != null ? ` · ${latestMeasurement.bodyFat.toFixed(1)}% BF` : ""}`
        : "brak danych",
      href: "/cialo",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182]">
          Statystyki tygodnia
        </h3>
        {lastSync && (
          <div className="flex items-center gap-1 text-[10px] text-[#5d6050] hover:text-[#8e9182] transition-colors">
            <RefreshCw className="h-3 w-3 shrink-0" />
            <span>Zsynchronizowano o {formatLastSync(lastSync.createdAt)}</span>
          </div>
        )}
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="flex flex-col gap-3 p-4 rounded-xl bg-[#141511] border border-[#2b2d24] hover:border-[#bce663]/30 transition-all duration-200 group"
          >
            {/* Icon + label */}
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tile.iconBg} ${tile.iconColor}`}>
                {tile.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#8e9182]">
                {tile.label}
              </span>
            </div>

            {/* Value */}
            <div>
              <p className="text-2xl font-extrabold text-white leading-none">
                {tile.value}
                {tile.unit && (
                  <span className="text-sm font-normal text-[#8e9182] ml-1">{tile.unit}</span>
                )}
              </p>
              <p className="text-[10px] text-[#5d6050] mt-1.5">{tile.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

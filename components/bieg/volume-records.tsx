import React from "react";
import { Compass, TrendingUp, Award } from "lucide-react";
import { RunningVolumeStats } from "@/lib/services/running-stats";

interface VolumeRecordsProps {
  stats: RunningVolumeStats;
  weeklyTargetKm?: number;
}

export default function VolumeRecords({ stats, weeklyTargetKm = 40 }: VolumeRecordsProps) {
  const progressPercent = Math.min(Math.round((stats.thisWeekRunKm / weeklyTargetKm) * 100), 100);

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Objętość</h3>
          <p className="text-xs text-zinc-500 mt-1">Podsumowanie dystansu i realizacji założeń</p>
        </div>
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Compass className="h-5 w-5 text-sky-400" />
        </div>
      </div>

      {/* Main progress bar - This Week Mileage */}
      <div className="mb-6">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm font-semibold text-zinc-300">W tym tygodniu</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-white">{stats.thisWeekRunKm.toFixed(1)}</span>
            <span className="text-xs text-zinc-500 font-mono">/ {weeklyTargetKm} km</span>
          </div>
        </div>
        <div className="w-full h-3 bg-zinc-900 border border-zinc-800/80 rounded-full overflow-hidden p-[2px]">
          <div
            className="h-full bg-gradient-to-r from-[#bce663] to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500 font-mono">
          <span>Cel: {weeklyTargetKm} km</span>
          <span>{progressPercent}% zrealizowane</span>
        </div>
      </div>

      {/* Sub metrics grid — bez "Spójność" */}
      <div className="grid grid-cols-2 gap-3">
        {/* Metric 1: Longest Run */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3.5 flex flex-col justify-between hover:border-zinc-800 transition-all duration-200">
          <div className="flex items-center text-zinc-500 gap-1.5">
            <Award className="h-3.5 w-3.5 text-[#bce663]" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Najdłuższy</span>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold font-mono text-white">{stats.longestRunKm.toFixed(1)}</span>
            <span className="text-[10px] text-zinc-500 ml-1 font-mono">km</span>
          </div>
        </div>

        {/* Metric 2: Max Weekly */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-3.5 flex flex-col justify-between hover:border-zinc-800 transition-all duration-200">
          <div className="flex items-center text-zinc-500 gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Max tydzień</span>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold font-mono text-white">{stats.maxWeeklyRunKm.toFixed(1)}</span>
            <span className="text-[10px] text-zinc-500 ml-1 font-mono">km</span>
          </div>
        </div>
      </div>
    </div>
  );
}

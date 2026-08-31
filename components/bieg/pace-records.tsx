import React from "react";
import { Trophy, Calendar, Zap } from "lucide-react";
import { PaceRecord } from "@/lib/services/running-stats";

interface PaceRecordsProps {
  records: Record<string, PaceRecord | null>;
}

export default function PaceRecords({ records }: PaceRecordsProps) {
  const distances = [
    { key: "1k", label: "1 km", defaultTarget: "3:30" },
    { key: "5k", label: "5 km", defaultTarget: "20:00" },
    { key: "10k", label: "10 km", defaultTarget: "42:00" },
    { key: "Half", label: "Półmaraton", defaultTarget: "1:35:00" },
  ];

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Rekordy Życiowe (Strava)</h3>
          <p className="text-xs text-zinc-500 mt-1">Najlepsze szacowane czasy z Twoich biegów</p>
        </div>
        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
      </div>

      {/* Grid of records */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {distances.map((dist) => {
          const record = records[dist.key];

          if (record) {
            return (
              <div
                key={dist.key}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-all duration-200"
              >
                <div>
                  <span className="text-xs font-semibold text-zinc-400">{dist.label}</span>
                  <div className="text-2xl font-extrabold font-mono text-[#bce663] mt-1.5 tracking-tight">
                    {record.formattedTime}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-col gap-1.5">
                  <div className="flex items-center text-xs text-zinc-300 font-mono font-medium">
                    <Zap className="h-3 w-3 mr-1 text-sky-400" />
                    {record.paceMinKm}
                  </div>
                  <div className="flex items-center text-[10px] text-zinc-500 font-mono">
                    <Calendar className="h-3 w-3 mr-1" />
                    {record.date}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5" title={record.activityName}>
                    {record.activityName}
                  </div>
                </div>
              </div>
            );
          }

          // Empty state for this specific distance
          return (
            <div
              key={dist.key}
              className="bg-zinc-900/30 border border-zinc-800/40 rounded-xl p-4 flex flex-col justify-between opacity-60 border-dashed"
            >
              <div>
                <span className="text-xs font-medium text-zinc-500">{dist.label}</span>
                <div className="text-xl font-bold font-mono text-zinc-600 mt-2">--:--</div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/20 text-[10px] text-zinc-600 italic">
                Brak rekordu w bazie
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { IntensityClass } from "@/app/generated/prisma/client";
import { Calendar, Clock, Compass, Activity, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import WorkoutDetailModal, { WorkoutSessionDetail } from "@/components/dashboard/workout-detail-modal";

export interface PlannedRunSession {
  id: string;
  date: string | Date;
  type: string;
  name: string;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetVolume?: number | null;
  notes?: string | null;
  source?: string;
  intensityClass?: IntensityClass | null;
  statuses?: { status: string }[] | null;
}

interface PlannedRunsProps {
  sessions: PlannedRunSession[];
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

function formatPlannedDate(dateInput: string | Date): string {
  try {
    const dStr = typeof dateInput === "string" ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
    const parts = dStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const localDate = new Date(year, month, day);

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      if (dStr === todayStr) return "Dziś";
      if (dStr === tomorrowStr) return "Jutro";

      let formatted = format(localDate, "eee, d MMM", { locale: pl });
      // Usuwamy kropkę po skrócie dnia tygodnia np. "sob.," -> "sob," lub "wt.," -> "wt,"
      formatted = formatted.replace(/^(\w+)\./, "$1");
      return formatted.replace(/^\w/, (c) => c.toUpperCase());
    }
  } catch (e) {}

  const date = new Date(dateInput);
  let formatted = format(date, "eee, d MMM", { locale: pl });
  formatted = formatted.replace(/^(\w+)\./, "$1");
  return formatted.replace(/^\w/, (c) => c.toUpperCase());
}

export default function PlannedRuns({ sessions }: PlannedRunsProps) {
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutSessionDetail | null>(null);

  // Filtrujemy tylko zaplanowane sesje przyszłe lub dzisiejsze
  const sortedSessions = [...sessions].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group flex flex-col h-full">
      {/* Nagłówek */}
      <div className="mb-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#bce663]" />
          Zaplanowane Treningi
        </h3>
        <p className="text-xs text-zinc-500 mt-1">Nadchodzące sesje z Twojego planu Runna</p>
      </div>

      {/* Lista treningów */}
      <div className="space-y-3 flex-grow overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">
        {sortedSessions.length > 0 ? (
          sortedSessions.map((session) => {
            const intClass = session.intensityClass ? INTENSITY_LABELS[session.intensityClass] : null;
            const distanceKm = session.targetDistance ? (session.targetDistance / 1000).toFixed(1) : null;
            const durationMin = session.targetDuration ? Math.round(session.targetDuration / 60) : null;

            return (
              <div
                key={session.id}
                onClick={() => setSelectedWorkout(session as any)}
                className="bg-[#141511] border border-[#2b2d24] rounded-xl p-3.5 hover:border-[#bce663]/40 cursor-pointer transition-all active:scale-[0.98] group/card flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  {/* Badge z datą */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-14 h-14 rounded-xl bg-[#1e2019] border border-[#2b2d24] group-hover/card:border-[#bce663]/20 transition-colors">
                    <span className="text-[10px] font-bold text-[#8e9182] uppercase tracking-wider text-center leading-tight">
                      {formatPlannedDate(session.date).split(",")[0]}
                    </span>
                    <span className="text-xs font-black text-white mt-0.5">
                      {formatPlannedDate(session.date).split(",")[1] || ""}
                    </span>
                  </div>

                  {/* Informacje o treningu */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white group-hover/card:text-[#bce663] transition-colors line-clamp-1 leading-snug">
                      {session.name}
                    </h4>

                    {/* Metryki celu */}
                    <div className="flex items-center gap-2.5 text-[10px] font-mono text-[#8e9182]">
                      {distanceKm && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-[#bce663]" />
                          {distanceKm} km
                        </span>
                      )}
                      {durationMin && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {durationMin} min
                        </span>
                      )}
                      {!distanceKm && !durationMin && <span>Sesja bez celów</span>}
                    </div>

                    {/* Etykieta intensywności */}
                    {intClass && (
                      <span
                        className={`inline-block text-[8px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded ${intClass.bg} ${intClass.text}`}
                      >
                        {intClass.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Przycisk akcji / Chevron */}
                <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-[#1e2019] border border-[#2b2d24] group-hover/card:bg-[#bce663] group-hover/card:border-[#bce663] transition-all">
                  <ChevronRight className="h-4 w-4 text-zinc-500 group-hover/card:text-[#0d0e0c] transition-colors" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-[#2b2d24] rounded-xl bg-[#141511]/30">
            <Compass className="h-8 w-8 text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-500 font-bold">Brak zaplanowanych biegów</p>
            <p className="text-[10px] text-zinc-600 mt-1">Ukończyłeś już wszystkie biegi z obecnego planu.</p>
          </div>
        )}
      </div>

      {/* Modal Szczegółów po kliknięciu */}
      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  );
}

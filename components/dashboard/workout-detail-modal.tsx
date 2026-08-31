"use client";

import { Modal } from "@/components/ui/modal";
import { Activity, Bike, Dumbbell, Compass, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export interface WorkoutSessionDetail {
  id: string;
  name: string;
  type: "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "OTHER" | string;
  date: string | Date;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetVolume?: number | null;
  notes?: string | null;
  intensityClass?: string | null;
  statuses?: { status: string }[] | null;
}

interface WorkoutDetailModalProps {
  workout: WorkoutSessionDetail | null;
  onClose: () => void;
}

// Bezpieczne formatowanie daty bez wpływu strefy czasowej (GMT/UTC offset)
function formatLocalWorkoutDate(dateInput: string | Date): string {
  try {
    const dStr = typeof dateInput === "string" ? dateInput.slice(0, 10) : dateInput.toISOString().slice(0, 10);
    const parts = dStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const localDate = new Date(year, month, day);
      return format(localDate, "EEEE, d MMMM yyyy", { locale: pl });
    }
  } catch (e) {}
  
  return format(new Date(dateInput), "EEEE, d MMMM yyyy", { locale: pl });
}

const TYPE_LABELS: Record<string, string> = {
  RUN: "Bieg",
  RIDE: "Rower",
  STRENGTH: "Siła",
  OTHER: "Inny",
};

const INTENSITY_LABELS: Record<string, string> = {
  RECOVERY: "Regeneracyjny",
  EASY: "Spokojny",
  STEADY: "Steady (Stałe tempo)",
  TEMPO: "Tempo",
  THRESHOLD: "Progowy",
  INTERVAL: "Interwały",
  LONG: "Długi bieg",
  RACE: "Zawody",
  OTHER: "Standardowy",
};

export default function WorkoutDetailModal({ workout, onClose }: WorkoutDetailModalProps) {
  if (!workout) return null;

  const status = workout.statuses?.[0]?.status ?? "PLANNED";

  const getIcon = (type: string) => {
    switch (type) {
      case "RUN":
        return <Activity className="h-5 w-5 text-[#bce663]" />;
      case "RIDE":
        return <Bike className="h-5 w-5 text-sky-400" />;
      case "STRENGTH":
        return <Dumbbell className="h-5 w-5 text-amber-400" />;
      default:
        return <Compass className="h-5 w-5 text-[#8e9182]" />;
    }
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "DONE":
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 rounded-lg px-2.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ukończony
          </span>
        );
      case "MISSED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Pominięty
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-800 border border-zinc-700/30 rounded-lg px-2.5 py-1">
            <Circle className="h-3.5 w-3.5" /> Zaplanowany
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={workout !== null}
      onClose={onClose}
      title="Szczegóły zaplanowanego treningu"
      description={formatLocalWorkoutDate(workout.date)}
      size="md"
    >
      <div className="space-y-5">
        {/* Typ i Nazwa */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#141511] border border-[#2b2d24]">
              {getIcon(workout.type)}
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-snug">{workout.name}</h3>
              <p className="text-[10px] font-mono text-[#8e9182] mt-0.5 uppercase">
                {TYPE_LABELS[workout.type] || "Aktywność"}
              </p>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge(status)}</div>
        </div>

        {/* Parametry treningu */}
        <div className="grid grid-cols-2 gap-3 bg-[#141511] p-4 rounded-2xl border border-[#2b2d24]">
          {workout.type === "STRENGTH" ? (
            <div>
              <p className="text-[9px] font-bold text-[#8e9182] uppercase tracking-wider">Objętość docelowa</p>
              <p className="text-base font-black text-white mt-1">
                {workout.targetVolume ? `${workout.targetVolume.toLocaleString("pl-PL")} kg` : "—"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[9px] font-bold text-[#8e9182] uppercase tracking-wider">Dystans docelowy</p>
              <p className="text-base font-black text-white mt-1">
                {workout.targetDistance ? `${(workout.targetDistance / 1000).toFixed(1)} km` : "—"}
              </p>
            </div>
          )}
          
          <div>
            <p className="text-[9px] font-bold text-[#8e9182] uppercase tracking-wider">Czas docelowy</p>
            <p className="text-base font-black text-white mt-1">
              {workout.targetDuration ? `${Math.round(workout.targetDuration / 60)} min` : "—"}
            </p>
          </div>
        </div>

        {/* Intensywność */}
        {workout.intensityClass && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8e9182]">Klasa intensywności:</span>
            <span className="font-extrabold text-[#bce663] bg-[#bce663]/5 px-2 py-0.5 rounded border border-[#bce663]/10">
              {INTENSITY_LABELS[workout.intensityClass] || workout.intensityClass}
            </span>
          </div>
        )}

        {/* Notatki / Wskazówki */}
        {workout.notes && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[9px] font-bold text-[#8e9182] uppercase tracking-wider">Opis i wskazówki treningowe</p>
            <div className="bg-[#141511] border border-[#2b2d24] p-4 rounded-2xl text-xs text-[#e2e3d8] whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto custom-scrollbar">
              {workout.notes}
            </div>
          </div>
        )}

        {/* Stopka z przyciskiem zamknięcia */}
        <div className="flex pt-2">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-[#bce663] py-2.5 text-xs font-black text-[#0d0e0c] hover:bg-[#a6cc4f] active:scale-[0.98] transition-all"
          >
            Zamknij
          </button>
        </div>
      </div>
    </Modal>
  );
}

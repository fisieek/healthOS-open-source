"use client";

import { MuscleGroup, muscleGroupLabels } from "@/lib/services/muscle-groups";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Trophy, TrendingUp } from "lucide-react";

export interface RecordData {
  exerciseName: string;
  weight: number;
  reps: number;
  e1RM: number;
  date: Date;
  sparklineData: number[]; // Ostatnie 5 tonaży tej partii
}

interface RecordsGridProps {
  records: Partial<Record<MuscleGroup, RecordData>>;
}

const keyMuscleGroups: Exclude<MuscleGroup, 'OTHER'>[] = [
  'CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'CORE', 'CALVES', 'FOREARMS'
];

export default function RecordsGrid({ records }: RecordsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {keyMuscleGroups.map((group) => {
        const record = records[group];
        const label = muscleGroupLabels[group];

        return (
          <div
            key={group}
            className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-4 shadow-lg hover:border-[#bce663]/30 transition-all duration-300 flex flex-col justify-between group h-[170px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2b2d24] pb-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">
                {label}
              </span>
              <Trophy className="h-3.5 w-3.5 text-[#5d6050] group-hover:text-[#bce663] transition-colors" />
            </div>

            {record ? (
              <div className="flex-1 flex flex-col justify-between">
                {/* Wartości Rekordu */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-[#bce663] tracking-tight">
                      {record.weight > 0 ? record.e1RM.toFixed(1) : record.reps}
                    </span>
                    <span className="text-xs font-bold text-[#8e9182]">
                      {record.weight > 0 ? "kg e1RM" : "powt."}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-white truncate mt-1">
                    {record.exerciseName}
                  </p>
                  <p className="text-[10px] text-[#8e9182] mt-0.5">
                    {record.weight > 0 ? `${record.weight} kg × ${record.reps} powt.` : `${record.reps} powtórzeń`}
                  </p>
                </div>

                {/* Dół karty ze Sparkline */}
                <div className="flex items-end justify-between mt-2 pt-2 border-t border-[#2b2d24]/50">
                  <span className="text-[9px] text-[#5d6050] font-mono">
                    {format(new Date(record.date), "dd.MM.yyyy", { locale: pl })}
                  </span>

                  {/* Sparkline SVG */}
                  {record.sparklineData.length > 1 ? (
                    <div className="w-16 h-7 relative select-none">
                      <Sparkline data={record.sparklineData} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[8px] text-[#5d6050] font-bold uppercase">
                      <TrendingUp className="h-2 w-2" />
                      Stabilnie
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-center">
                <p className="text-[10px] text-[#5d6050] font-medium uppercase tracking-wider">
                  Brak treningów
                </p>
                <p className="text-[9px] text-[#42443a] mt-0.5">
                  Dodaj ćwiczenie z tej partii
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const points = data;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0); // od zera, żeby widzieć progres
  const range = max - min;

  const width = 64;
  const height = 28;
  const padding = 2;

  const coords = points.map((val, index) => {
    const x = padding + (index / (points.length - 1)) * (width - 2 * padding);
    const y =
      height -
      padding -
      ((val - min) / (range || 1)) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const polylinePoints = coords.join(" ");

  // Zamknięta ścieżka do wypełnienia gradientem
  const fillPoints = `${padding},${height} ${polylinePoints} ${width - padding},${height}`;

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bce663" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#bce663" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {/* Obszar pod linią */}
      <polygon points={fillPoints} fill="url(#sparklineGrad)" />
      {/* Linia sparkline */}
      <polyline
        fill="none"
        stroke="#bce663"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {/* Kropka na końcu */}
      {coords.length > 0 && (
        <circle
          cx={coords[coords.length - 1].split(",")[0]}
          cy={coords[coords.length - 1].split(",")[1]}
          r="2"
          fill="#bce663"
        />
      )}
    </svg>
  );
}

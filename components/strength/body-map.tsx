"use client";

import { useState } from "react";
import { MuscleGroup, muscleGroupLabels } from "@/lib/services/muscle-groups";

type Period = 'week' | 'month' | 'year' | 'all';

interface BodyMapProps {
  selectedGroup: MuscleGroup | null;
  onSelectGroup: (group: MuscleGroup | null) => void;
  /** @deprecated używane tylko dla kompatybilności wstecznej */
  muscleVolumes?: Record<MuscleGroup, number>;
  muscleSetCounts?: Record<Period, Record<MuscleGroup, number>>;
}

const PERIOD_LABELS: Record<Period, string> = {
  week:  'Tydzień',
  month: 'Miesiąc',
  year:  'Rok',
  all:   'Ogółem',
};

// Grupy widoczne na sylwetce SVG
const BODY_GROUPS: Exclude<MuscleGroup, 'CARDIO' | 'PLYO' | 'STRETCHING' | 'OTHER'>[] = [
  'CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'CORE', 'CALVES', 'FOREARMS',
];

// Grupy bez reprezentacji na sylwetce — pokazywane jako kafelki pod mapą
const EXTRA_GROUPS: Extract<MuscleGroup, 'CARDIO' | 'PLYO' | 'STRETCHING'>[] = [
  'CARDIO', 'PLYO', 'STRETCHING',
];

export default function BodyMap({ selectedGroup, onSelectGroup, muscleVolumes, muscleSetCounts }: BodyMapProps) {
  const [hoveredGroup, setHoveredGroup] = useState<MuscleGroup | null>(null);
  const [period, setPeriod] = useState<Period>('month');

  // Aktywny zestaw serii dla wybranego okresu
  const activeCounts: Record<MuscleGroup, number> = muscleSetCounts?.[period] ?? {
    CHEST: 0, BACK: 0, LEGS: 0, SHOULDERS: 0, BICEPS: 0,
    TRICEPS: 0, CORE: 0, CALVES: 0, FOREARMS: 0,
    CARDIO: 0, PLYO: 0, STRETCHING: 0, OTHER: 0,
  };

  // Max serii spośród grup widocznych na mapie (do skalowania)
  const maxSets = Math.max(...BODY_GROUPS.map(g => activeCounts[g]), 1);

  const getIntensityColor = (group: MuscleGroup, isHovered: boolean, isSelected: boolean): string => {
    if (isSelected) return "#bce663";

    const sets = activeCounts[group] ?? 0;
    if (sets === 0) {
      return isHovered ? "#2b2d24" : "#1a1c18";
    }

    // Skala: min 15% opacity (1 seria widoczna), max 85%
    const pct = sets / maxSets;
    const opacity = 0.15 + pct * 0.70;

    if (isHovered) return `rgba(188, 230, 99, ${Math.min(1, opacity + 0.20)})`;
    return `rgba(188, 230, 99, ${opacity})`;
  };

  const handleGroupClick = (group: MuscleGroup) => {
    onSelectGroup(selectedGroup === group ? null : group);
  };

  const sharedProps = (group: MuscleGroup) => ({
    fill: getIntensityColor(group, hoveredGroup === group, selectedGroup === group),
    stroke: "#2b2d24",
    strokeWidth: 1.5 as number,
    className: "cursor-pointer transition-all duration-200",
    onMouseEnter: () => setHoveredGroup(group),
    onMouseLeave: () => setHoveredGroup(null),
    onClick: () => handleGroupClick(group),
  });

  const activeGroup = hoveredGroup ?? selectedGroup;
  const activeSets = activeGroup ? (activeCounts[activeGroup] ?? 0) : null;

  return (
    <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg flex flex-col gap-3">

      {/* NAGŁÓWEK */}
      <div className="flex items-start justify-between border-b border-[#2b2d24] pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182]">Mapa aktywności mięśniowej</h3>
          <p className="text-[10px] text-[#5d6050] mt-0.5">Liczba serii per partia · kliknij, aby filtrować</p>
        </div>
        {activeGroup && (
          <span className="text-[10px] font-black uppercase text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 px-2.5 py-1 rounded-md shrink-0">
            {muscleGroupLabels[activeGroup]}
            {activeSets !== null && (
              <span className="ml-1.5 text-white/60 font-normal normal-case">
                {activeSets} {activeSets === 1 ? 'seria' : activeSets < 5 ? 'serie' : 'serii'}
              </span>
            )}
          </span>
        )}
      </div>

      {/* PRZEŁĄCZNIK OKRESU */}
      <div className="flex items-center bg-[#141511] border border-[#2b2d24] rounded-lg p-0.5 self-start">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
              period === p
                ? "bg-[#bce663] text-black"
                : "text-[#8e9182] hover:text-white"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* SYLWETKI */}
      <div className="flex items-center justify-center gap-10 w-full select-none">

        {/* PRZÓD */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-bold text-[#5d6050] uppercase tracking-widest mb-1.5">PRZÓD</span>
          <svg viewBox="0 0 100 220" className="h-[200px] w-auto">
            <circle cx="50" cy="110" r="85" fill="none" stroke="#2b2d24" strokeWidth="0.5" strokeDasharray="3 3" />

            {/* GŁOWA */}
            <circle cx="50" cy="20" r="11" fill="#141511" stroke="#2b2d24" strokeWidth="1.5" />
            {/* SZYJA */}
            <path d="M47 31 L53 31 L53 37 L47 37 Z" fill="#141511" stroke="#2b2d24" strokeWidth="1.5" />

            {/* BARKI */}
            <path d="M34 39 C38 37, 43 38, 46 39 C46 39, 44 48, 38 48 C34 45, 33 42, 34 39 Z" {...sharedProps("SHOULDERS")} />
            <path d="M66 39 C62 37, 57 38, 54 39 C54 39, 56 48, 62 48 C66 45, 67 42, 66 39 Z" {...sharedProps("SHOULDERS")} />

            {/* KLATKA */}
            <path d="M39 44 C42 42, 48 42, 50 44 C52 42, 58 42, 61 44 L59 66 C55 68, 45 68, 41 66 Z" {...sharedProps("CHEST")} />

            {/* BICEPSY */}
            <path d="M33 44 C33 44, 27 52, 29 65 C31 65, 33 60, 35 52 Z" {...sharedProps("BICEPS")} />
            <path d="M67 44 C67 44, 73 52, 71 65 C69 65, 67 60, 65 52 Z" {...sharedProps("BICEPS")} />

            {/* PRZEDRAMIONA */}
            <path d="M29 67 L24 95 L28 95 L33 67 Z" {...sharedProps("FOREARMS")} />
            <path d="M71 67 L76 95 L72 95 L67 67 Z" {...sharedProps("FOREARMS")} />

            {/* CORE */}
            <path d="M41 68 C45 70, 55 70, 59 68 L57 106 L43 106 Z" {...sharedProps("CORE")} />

            {/* UDA */}
            <path d="M38 111 L48 111 L45 165 L36 165 C34 145, 35 125, 38 111 Z" {...sharedProps("LEGS")} />
            <path d="M62 111 L52 111 L55 165 L64 165 C66 145, 65 125, 62 111 Z" {...sharedProps("LEGS")} />

            {/* ŁYDKI */}
            <path d="M37 169 L44 169 L42 208 L39 208 Z" {...sharedProps("CALVES")} />
            <path d="M63 169 L56 169 L58 208 L61 208 Z" {...sharedProps("CALVES")} />
          </svg>
        </div>

        {/* TYŁ */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-bold text-[#5d6050] uppercase tracking-widest mb-1.5">TYŁ</span>
          <svg viewBox="0 0 100 220" className="h-[200px] w-auto">
            <circle cx="50" cy="110" r="85" fill="none" stroke="#2b2d24" strokeWidth="0.5" strokeDasharray="3 3" />

            {/* GŁOWA */}
            <circle cx="50" cy="20" r="11" fill="#141511" stroke="#2b2d24" strokeWidth="1.5" />
            {/* SZYJA */}
            <path d="M47 31 L53 31 L53 37 L47 37 Z" fill="#141511" stroke="#2b2d24" strokeWidth="1.5" />

            {/* BARKI */}
            <path d="M34 39 C38 37, 43 38, 46 39 C46 39, 44 48, 38 48 C34 45, 33 42, 34 39 Z" {...sharedProps("SHOULDERS")} />
            <path d="M66 39 C62 37, 57 38, 54 39 C54 39, 56 48, 62 48 C66 45, 67 42, 66 39 Z" {...sharedProps("SHOULDERS")} />

            {/* PLECY */}
            <path d="M38 42 C44 45, 56 45, 62 42 L59 104 C55 106, 45 106, 41 104 Z" {...sharedProps("BACK")} />

            {/* TRICEPSY */}
            <path d="M33 44 C33 44, 27 52, 29 65 C31 65, 33 60, 35 52 Z" {...sharedProps("TRICEPS")} />
            <path d="M67 44 C67 44, 73 52, 71 65 C69 65, 67 60, 65 52 Z" {...sharedProps("TRICEPS")} />

            {/* PRZEDRAMIONA */}
            <path d="M29 67 L24 95 L28 95 L33 67 Z" {...sharedProps("FOREARMS")} />
            <path d="M71 67 L76 95 L72 95 L67 67 Z" {...sharedProps("FOREARMS")} />

            {/* POŚLADKI */}
            <path d="M40 106 C44 104, 56 104, 60 106 C62 114, 61 125, 59 128 L51 128 L51 106 L49 106 L49 128 L41 128 C39 125, 38 114, 40 106 Z" {...sharedProps("LEGS")} />

            {/* UDA TYŁ */}
            <path d="M36 128 L48 128 L45 165 L36 165 Z" {...sharedProps("LEGS")} />
            <path d="M64 128 L52 128 L55 165 L64 165 Z" {...sharedProps("LEGS")} />

            {/* ŁYDKI */}
            <path d="M37 169 L44 169 L42 208 L39 208 Z" {...sharedProps("CALVES")} />
            <path d="M63 169 L56 169 L58 208 L61 208 Z" {...sharedProps("CALVES")} />
          </svg>
        </div>
      </div>

      {/* LEGENDA SKALI */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[9px] text-[#5d6050] font-mono shrink-0">0</span>
        <div className="flex-1 h-1.5 rounded-full" style={{
          background: 'linear-gradient(to right, #1a1c18, rgba(188,230,99,0.15), rgba(188,230,99,0.55), rgba(188,230,99,0.85))'
        }} />
        <span className="text-[9px] text-[#5d6050] font-mono shrink-0">{maxSets} serii</span>
      </div>

      {/* KAFELKI KARDIO / PYLO / ROZCIĄGANIE */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2b2d24]">
        {EXTRA_GROUPS.map(group => {
          const sets = activeCounts[group] ?? 0;
          const isSelected = selectedGroup === group;
          const isHovered = hoveredGroup === group;
          return (
            <button
              key={group}
              onClick={() => handleGroupClick(group)}
              onMouseEnter={() => setHoveredGroup(group)}
              onMouseLeave={() => setHoveredGroup(null)}
              className={`rounded-xl border px-3 py-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-[#bce663]/50 bg-[#bce663]/10'
                  : isHovered
                  ? 'border-[#2b2d24] bg-[#2b2d24]/60'
                  : 'border-[#2b2d24] bg-[#141511]'
              }`}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182]">
                {muscleGroupLabels[group]}
              </p>
              <p className={`text-base font-black mt-0.5 leading-none ${sets > 0 ? 'text-[#bce663]' : 'text-[#42443a]'}`}>
                {sets}
              </p>
              <p className="text-[8px] text-[#5d6050] mt-0.5">
                {sets === 1 ? 'seria' : sets < 5 ? 'serie' : 'serii'}
              </p>
            </button>
          );
        })}
      </div>

    </div>
  );
}

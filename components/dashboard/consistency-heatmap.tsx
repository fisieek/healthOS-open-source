"use client";

interface DayData {
  date: string;       // YYYY-MM-DD
  compliance: number; // 0 to 1
}

interface ConsistencyHeatmapProps {
  data: DayData[];
}

export default function ConsistencyHeatmap({ data }: ConsistencyHeatmapProps) {
  // Zapewniamy, że mamy dokładnie 35 dni do ułożenia w siatkę 7 rzędów x 5 kolumn
  const fillMissingDays = () => {
    const list = [...data].reverse(); // od najstarszych do najnowszych
    while (list.length < 35) {
      const oldestDate = list.length > 0 ? new Date(list[0].date) : new Date();
      oldestDate.setDate(oldestDate.getDate() - 1);
      list.unshift({
        date: oldestDate.toISOString().split("T")[0],
        compliance: 0
      });
    }
    return list.slice(-35); // Bierzemy dokładnie ostatnie 35 dni
  };

  const days = fillMissingDays();

  // Funkcja zwracająca odpowiedni kolor lime na podstawie poziomu compliance
  const getHeatmapColor = (compliance: number) => {
    if (compliance === 0) return "bg-[#2b2d24]/40 hover:bg-[#2b2d24]/60";
    if (compliance < 0.3) return "bg-[#bce663]/20 hover:bg-[#bce663]/30";
    if (compliance < 0.6) return "bg-[#bce663]/50 hover:bg-[#bce663]/60";
    if (compliance < 0.9) return "bg-[#bce663]/80 hover:bg-[#bce663]/90";
    return "bg-[#bce663] hover:shadow-[0_0_8px_#bce663]";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  };

  return (
    <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182]">
          Spójność (compliance)
        </h3>
        <p className="text-[10px] text-[#5d6050] mt-0.5">Ostatnie 35 dni aktywności i nawyków</p>
      </div>

      <div className="flex items-end gap-3 justify-center py-2">
        {/* Dni tygodnia labels */}
        <div className="grid grid-rows-7 gap-1 text-[8px] text-[#5d6050] h-[98px] pr-1 select-none">
          <span>Pn</span>
          <span></span>
          <span>Śr</span>
          <span></span>
          <span>Pi</span>
          <span></span>
          <span>Nd</span>
        </div>

        {/* Siatka kwadratów (7 rzędów x 5 kolumn, ułożone pionowo w kolumnach) */}
        <div className="grid grid-flow-col grid-rows-7 gap-[5px] h-[98px]">
          {days.map((day, idx) => (
            <div
              key={day.date}
              className={`w-3.5 h-3.5 rounded-sm transition-all duration-200 cursor-pointer relative group ${getHeatmapColor(day.compliance)}`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-20 w-32 rounded-lg bg-[#141511] border border-[#2b2d24] p-2 text-center shadow-xl animate-in fade-in zoom-in-95 duration-100">
                <p className="text-[9px] font-bold text-white">{formatDate(day.date)}</p>
                <p className="text-[9px] text-[#bce663] font-extrabold mt-0.5">
                  Spójność: {Math.round(day.compliance * 100)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-between text-[9px] text-[#5d6050] border-t border-[#2b2d24]/50 pt-3">
        <span>Mniej</span>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#2b2d24]/40" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#bce663]/20" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#bce663]/50" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#bce663]/80" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#bce663]" />
        </div>
        <span>Więcej</span>
      </div>
    </div>
  );
}

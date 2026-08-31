"use client";

import { useState, useMemo } from "react";
import { 
  AreaChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart
} from "recharts";
import { 
  Trophy, 
  Dumbbell, 
  Activity, 
  Flame, 
  Heart, 
  Info,
  ShieldAlert,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  calculateTrainingStress, 
  calculatePersonalBestsRuns, 
  calculatePersonalBestsLifts,
  ActivityTssData
} from "@/lib/services/training-analytics";

interface Props {
  activities: ActivityTssData[];
  strengthWorkouts: any[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1c18",
  border: "1px solid #2e3229",
  borderRadius: "12px",
  color: "#f1f2ec",
  fontSize: "11px",
};

const LABEL_STYLE = {
  color: "#8c9282",
  fontWeight: "bold",
  marginBottom: "4px",
};

export function TrainingAnalyticsTab({ activities, strengthWorkouts }: Props) {
  const [timeRange, setTimeRange] = useState<30 | 90 | 180>(90);

  // 1. Obliczanie CTL / ATL / TSB
  const chartData = useMemo(() => {
    return calculateTrainingStress(activities, strengthWorkouts, timeRange);
  }, [activities, strengthWorkouts, timeRange]);

  // Pobierz aktualne wartości (ostatni element)
  const currentMetrics = useMemo(() => {
    if (chartData.length === 0) return { ctl: 0, atl: 0, tsb: 0 };
    return chartData[chartData.length - 1];
  }, [chartData]);

  // 2. Wykrywanie Rekordów Życiowych
  const personalBestsRuns = useMemo(() => {
    return calculatePersonalBestsRuns(activities);
  }, [activities]);

  const personalBestsLifts = useMemo(() => {
    return calculatePersonalBestsLifts(strengthWorkouts);
  }, [strengthWorkouts]);

  // Interpretacja stanu TSB
  const tsbInterpretation = useMemo(() => {
    const tsb = currentMetrics.tsb;
    if (tsb < -30) {
      return {
        label: "Przeciążenie (Wysokie Ryzyko)",
        colorClass: "text-red-400 bg-red-500/10 border-red-500/20",
        description: "Twój bilans stresu treningowego jest bardzo ujemny. Sugerowana regeneracja i lekki tydzień, aby uniknąć kontuzji.",
        isCritical: true
      };
    } else if (tsb >= -30 && tsb < -10) {
      return {
        label: "Optymalny Trening",
        colorClass: "text-lime-400 bg-lime-500/10 border-lime-500/20",
        description: "Jesteś w optymalnej strefie bodźcowania organizmu. Budujesz formę bez nadmiernego ryzyka.",
        isCritical: false
      };
    } else if (tsb >= -10 && tsb <= 5) {
      return {
        label: "Strefa Przejściowa",
        colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        description: "Utrzymujesz aktualną formę. Odpowiedni moment na lekkie podbicie obciążeń lub stabilizację.",
        isCritical: false
      };
    } else {
      return {
        label: "Świeżość / Peaking",
        colorClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
        description: "Twój organizm jest w pełni zregenerowany i gotowy na maksymalny wysiłek lub zawody.",
        isCritical: false
      };
    }
  }, [currentMetrics.tsb]);

  const hasData = activities.length > 0 || strengthWorkouts.length > 0;

  if (!hasData) {
    return (
      <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
        Brak aktywności treningowych (biegów Strava lub treningów siłowych Hevy) w historii. Zaimportuj dane, aby wyliczyć wydolność.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK I FILTR OKRESU */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#1a1c18] p-4 rounded-2xl border border-[#2e3229]">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#8c9282]">
            Obciążenie Treningowe i Wydolność
          </h2>
          <p className="text-xs text-[#8c9282] mt-0.5">
            Modelowanie formy na podstawie algorytmów Banistera i Coggana (CTL/ATL/TSB)
          </p>
        </div>
        <div className="flex gap-1 bg-[#0d0e0c] p-1 rounded-xl border border-[#2e3229]">
          {([30, 90, 180] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${timeRange === days
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec]"
                }`}
            >
              {days} dni
            </button>
          ))}
        </div>
      </div>

      {/* KLUCZOWE METRYKI (WIDGETY) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Fitness (CTL) */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">Forma (CTL)</span>
              <TrendingUp className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <span className="text-3xl font-extrabold text-[#f1f2ec] font-mono">{currentMetrics.ctl}</span>
              <span className="text-xs text-[#8c9282] ml-1.5">chroniczne (42d)</span>
            </div>
            <p className="text-[10px] text-[#8c9282] mt-1">Im wyższa forma, tym większy poziom wytrenowania.</p>
          </CardContent>
        </Card>

        {/* Fatigue (ATL) */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">Zmęczenie (ATL)</span>
              <Flame className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <span className="text-3xl font-extrabold text-[#f1f2ec] font-mono">{currentMetrics.atl}</span>
              <span className="text-xs text-[#8c9282] ml-1.5">ostre (7d)</span>
            </div>
            <p className="text-[10px] text-[#8c9282] mt-1">Reakcja organizmu na ostatnie obciążenia treningowe.</p>
          </CardContent>
        </Card>

        {/* Balance (TSB) */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardContent className="p-5 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">Świeżość (TSB)</span>
              <Heart className="h-4 w-4 text-[#bce663]" />
            </div>
            <div>
              <span className={`text-3xl font-extrabold font-mono ${currentMetrics.tsb < 0 ? "text-orange-400" : "text-lime-400"}`}>
                {currentMetrics.tsb > 0 ? `+${currentMetrics.tsb}` : currentMetrics.tsb}
              </span>
              <span className="text-xs text-[#8c9282] ml-1.5">bilans (CTL-ATL)</span>
            </div>
            <p className="text-[10px] text-[#8c9282] mt-1">Dodatnie wartości oznaczają świeżość i regenerację.</p>
          </CardContent>
        </Card>

        {/* Interpretacja Strefy TSB */}
        <Card className={`border rounded-2xl overflow-hidden ${tsbInterpretation.colorClass}`}>
          <CardContent className="p-5 flex flex-col justify-between h-32 bg-black/10">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider opacity-85">Stan Organizmu</span>
              <ShieldAlert className="h-4 w-4 opacity-85" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">{tsbInterpretation.label}</span>
            </div>
            <p className="text-[10px] opacity-80 leading-normal mt-1">{tsbInterpretation.description}</p>
          </CardContent>
        </Card>
      </div>

      {/* ALERT O PRZETRENOWANIU */}
      {tsbInterpretation.isCritical && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3 items-start animate-in fade-in duration-300">
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-red-400 uppercase tracking-wide">Ryzyko Przetrenowania i Kontuzji</h5>
            <p className="text-xs text-[#a0a498]">
              Twój wskaźnik TSB spadł poniżej krytycznej wartości -30. Oznacza to, że obciążenie w ostatnim tygodniu drastycznie przewyższa Twoje długoterminowe możliwości regeneracyjne. Zdecydowanie zaleca się przeznaczenie najbliższych 48 godzin na pełną regenerację (np. rozciąganie, spacery, sen) i obniżenie intensywności treningów o połowę w kolejnych dniach.
            </p>
          </div>
        </div>
      )}

      {/* WYKRES FORMY (PMC) */}
      <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30 flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Performance Management Chart (PMC)
            </CardTitle>
            <CardDescription className="text-xs text-[#8c9282] mt-0.5">
              Wizualizacja zależności między formą (CTL), zmęczeniem (ATL) a świeżością (TSB)
            </CardDescription>
          </div>
          <div className="flex gap-4 text-[10px] font-semibold text-[#8c9282]">
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-cyan-400 rounded-full inline-block" /> Forma (CTL)</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-orange-400 rounded-full inline-block" /> Zmęczenie (ATL)</div>
            <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-lime-400/30 border border-lime-400 rounded-sm inline-block" /> Świeżość (TSB)</div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 px-4" style={{ height: 320, position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTsb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#84cc16" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
              <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
              <YAxis stroke="#5d6050" fontSize={10} name="TSS" />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
              <Area type="monotone" name="Świeżość (TSB)" dataKey="tsb" stroke="#84cc16" strokeWidth={1} fillOpacity={1} fill="url(#colorTsb)" />
              <Line type="monotone" name="Forma (CTL)" dataKey="ctl" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
              <Line type="monotone" name="Zmęczenie (ATL)" dataKey="atl" stroke="#fb923c" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* REKORDY ŻYCIOWE (PR) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Biegowe PR */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30 flex flex-row items-center gap-2">
            <Trophy className="h-4 w-4 text-[#bce663]" />
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
                Rekordy Biegowe
              </CardTitle>
              <CardDescription className="text-xs text-[#8c9282] mt-0.5">
                Najlepsze rezultaty na dystansach w biegach tlenowych i tempowych
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {personalBestsRuns.length === 0 ? (
              <p className="text-xs text-[#8c9282] py-4 text-center">Brak zdefiniowanych rekordów biegowych.</p>
            ) : (
              <div className="space-y-2">
                {personalBestsRuns.map((r, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#0d0e0c]/40 border border-[#2e3229] rounded-xl p-3">
                    <div>
                      <span className="text-xs font-bold text-[#f1f2ec]">{r.distanceLabel}</span>
                      <p className="text-[10px] text-[#8c9282] mt-0.5">{r.activityName} · {r.date}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-[#bce663] font-mono">{r.recordValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Siłowe PR */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30 flex flex-row items-center gap-2">
            <Dumbbell className="h-4 w-4 text-[#bce663]" />
            <div>
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
                Rekordy Siłowe (1RM)
              </CardTitle>
              <CardDescription className="text-xs text-[#8c9282] mt-0.5">
                Szacowane maksymalne obciążenie dla 1 powtórzenia (wzór Epleya)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {personalBestsLifts.length === 0 ? (
              <p className="text-xs text-[#8c9282] py-4 text-center">Brak zdefiniowanych rekordów siłowych.</p>
            ) : (
              <div className="space-y-2">
                {personalBestsLifts.map((l, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#0d0e0c]/40 border border-[#2e3229] rounded-xl p-3">
                    <div>
                      <span className="text-xs font-bold text-[#f1f2ec]">{l.exerciseName}</span>
                      <p className="text-[10px] text-[#8c9282] mt-0.5">{l.weight} kg × {l.reps} powt. · {l.date}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#bce663] font-mono">{l.oneRepMax} kg</div>
                      <span className="text-[9px] text-[#8c9282] block mt-0.5">szacowany 1RM</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

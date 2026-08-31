"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Check, Plus, Minus,
  Moon, Smile, Zap, Calendar, Sparkles, Edit2, Pill,
  AlertTriangle,
} from "lucide-react";
import MoodModal from "./mood-modal";
import HabitEditModal from "./habit-edit-modal";

interface HabitTask {
  id: string;
  name: string;
  type: "BOOLEAN" | "QUANTITY" | "TIME";
  targetValue: number | null;
  unit: string | null;
  frequency: string;
  step: number | null;
  completed: boolean;
  value: number | null;
  notes: string | null;
}

interface PlannedWorkout {
  id: string;
  name: string;
  type: string;
  targetDistance: number | null;
  targetDuration: number | null;
  statuses: { status: string }[];
}

// Pomocnicza funkcja — zwraca "dziś" w lokalnej strefie czasowej (YYYY-MM-DD)
function getLocalToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DailyTasksProps {
  initialDate?: string; // opcjonalne — ignorowane, używamy lokalnej daty klienta
}

export default function DailyTasks({ initialDate }: DailyTasksProps) {
  // Zawsze inicjalizujemy lokalną datą klienta — ignorujemy initialDate z serwera
  // żeby uniknąć błędu strefy czasowej (serwer UTC vs klient UTC+2)
  const [dateStr, setDateStr] = useState<string>(() => getLocalToday());
  const [loading, setLoading] = useState(false);
  const [habits, setHabits] = useState<HabitTask[]>([]);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [plannedWorkouts, setPlannedWorkouts] = useState<PlannedWorkout[]>([]);
  const [wellness, setWellness] = useState<any | null>(null);
  const [sleep, setSleep] = useState<any | null>(null);
  const [activeReferrals, setActiveReferrals] = useState<any[]>([]);
  const [isMoodOpen, setIsMoodOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchData = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/habits/today?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        setHabits(data.habits || []);
        setPlannedWorkouts(data.plannedWorkouts || []);
        setWellness(data.wellness || null);
        setSleep(data.sleep || null);
        setSupplements(data.supplements || []);
        setActiveReferrals(data.activeReferrals || []);
      }
    } catch (err) {
      console.error("Błąd ładowania zadań na dziś:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(dateStr); }, [dateStr]);

  // Nasłuchuj zmian planu z weekly-plan (custom event)
  useEffect(() => {
    const handler = () => fetchData(dateStr);
    window.addEventListener("plan-changed", handler);
    return () => window.removeEventListener("plan-changed", handler);
  }, [dateStr]);

  const changeDate = (days: number) => {
    const d = new Date(dateStr + "T12:00:00"); // noon — unikamy DST edge case
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setDateStr(`${year}-${month}-${day}`);
  };

  // Klik w cały wiersz nawyku
  const handleHabitRowClick = async (habit: HabitTask) => {
    const isQty = habit.type === "QUANTITY" || habit.type === "TIME";

    let newValue: number | null = null;
    let newCompleted: boolean;

    if (isQty) {
      // Klik wypełnia do max (jeśli nie pełny) lub resetuje do 0 (jeśli pełny)
      if (habit.completed) {
        newValue = 0;
        newCompleted = false;
      } else {
        newValue = habit.targetValue ?? 1;
        newCompleted = true;
      }
    } else {
      // BOOLEAN — toggle
      newCompleted = !habit.completed;
    }

    // Optimistic
    setHabits((prev) =>
      prev.map((h) => h.id === habit.id ? { ...h, completed: newCompleted, value: newValue } : h)
    );

    try {
      await fetch("/api/habits/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId: habit.id,
          date: dateStr,
          completed: newCompleted,
          value: newValue,
        }),
      });
      fetchData(dateStr);
    } catch {
      fetchData(dateStr);
    }
  };

  // +/- buttons (nie propagują kliku do wiersza)
  const handleQuantityChange = async (habit: HabitTask, delta: number) => {
    const step = habit.step ?? 1;
    const currentVal = habit.value ?? 0;
    const newVal = Math.max(0, parseFloat((currentVal + delta * step).toFixed(2)));
    const isCompleted = habit.targetValue ? newVal >= habit.targetValue : newVal > 0;

    setHabits((prev) =>
      prev.map((h) => h.id === habit.id ? { ...h, value: newVal, completed: isCompleted } : h)
    );

    try {
      await fetch("/api/habits/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitId: habit.id,
          date: dateStr,
          completed: isCompleted,
          value: newVal,
        }),
      });
      fetchData(dateStr);
    } catch {
      fetchData(dateStr);
    }
  };

  const handleWorkoutStatus = async (planSessionId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "DONE" ? "PLANNED" : "DONE";
    try {
      const res = await fetch(`/api/plan/${planSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchData(dateStr);
        // Notify weekly-plan
        window.dispatchEvent(new Event("plan-changed"));
      }
    } catch {}
  };

  const handleSupplementToggle = async (supp: any) => {
    const isCompleted = !supp.completed;

    // Optymistyczna zmiana stanu na UI
    setSupplements((prev) =>
      prev.map((s) =>
        s.id === supp.id
          ? {
              ...s,
              completed: isCompleted,
              value: isCompleted ? 1 : 0,
            }
          : s
      )
    );

    try {
      if (isCompleted) {
        await fetch(`/api/health/supplements/${supp.id}/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr, portion: 1 }),
        });
      } else {
        await fetch(`/api/health/supplements/${supp.id}/intake?date=${dateStr}`, {
          method: "DELETE",
        });
      }
      fetchData(dateStr);
    } catch (err) {
      console.error("Błąd przy zmianie stanu suplementu:", err);
      fetchData(dateStr);
    }
  };

  const formattedDateLabel = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "short" };
    const date = new Date(dateStr);
    const today = getLocalToday();
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (dateStr === today) return "Dzisiaj";
    if (dateStr === yesterday) return "Wczoraj";
    return date.toLocaleDateString("pl-PL", options);
  };

  const completedHabitsCount = habits.filter((h) => h.completed).length;
  const totalHabitsCount = habits.length;
  const progressPercent = totalHabitsCount > 0 ? Math.round((completedHabitsCount / totalHabitsCount) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-5">
      {/* Alert o wygasających skierowaniach przeniesiony do `AgendaTile`
          (components/dashboard/agenda-tile.tsx) — agenda pokrywa skierowania
          i cztery pozostałe źródła, więc trzymanie obu dublowałoby ten sam wpis. */}

      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => changeDate(-1)} className="rounded-lg p-1.5 text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-white min-w-[80px] text-center">{formattedDateLabel()}</span>
          <button onClick={() => changeDate(1)} className="rounded-lg p-1.5 text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#8e9182]">
          <Calendar className="h-3.5 w-3.5" />
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Progress */}
      {totalHabitsCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#e2e3d8]">Dzienny cel nawyków</span>
            <span className="text-[#bce663] font-bold">{completedHabitsCount}/{totalHabitsCount} ({progressPercent}%)</span>
          </div>
          <div className="h-1.5 w-full bg-[#2b2d24] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#bce663] rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(188,230,99,0.4)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* TRENINGI NA DZIŚ — na samej górze */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182] flex items-center gap-1.5">
          <span>📋 Treningi na dziś</span>
        </h3>

        {plannedWorkouts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2b2d24] p-4 text-center text-xs text-[#5d6050]">
            Brak zaplanowanych treningów.
          </div>
        ) : (
          <div className="space-y-2">
            {plannedWorkouts.map((workout) => {
              const status = workout.statuses[0]?.status || "PLANNED";
              const isDone = status === "DONE";
              return (
                <button
                  key={workout.id}
                  onClick={() => handleWorkoutStatus(workout.id, status)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isDone
                      ? "border-[#bce663]/30 bg-[#bce663]/5"
                      : "border-[#2b2d24] bg-[#141511] hover:border-[#3d4032]"
                  }`}
                >
                  <div className="min-w-0 text-left">
                    <p className={`text-xs font-bold truncate ${isDone ? "text-white line-through opacity-70" : "text-[#e2e3d8]"}`}>
                      {workout.name}
                    </p>
                    <p className="text-[10px] text-[#8e9182] mt-0.5">
                      {workout.type}
                      {workout.targetDistance ? ` · ${(workout.targetDistance / 1000).toFixed(1)}km` : ""}
                      {workout.targetDuration ? ` · ${Math.round(workout.targetDuration / 60)}min` : ""}
                    </p>
                  </div>
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      isDone
                        ? "border-[#bce663] bg-[#bce663] text-[#0d0e0c]"
                        : "border-[#5d6050] bg-transparent"
                    }`}
                  >
                    {isDone && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* NAWYKI z przyciskiem edycji */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182] flex items-center gap-1.5">
            <span>⚡ Nawyki</span>
            {loading && <span className="h-1.5 w-1.5 rounded-full bg-[#bce663] animate-ping" />}
          </h3>
          <button
            onClick={() => setIsEditOpen(true)}
            className="rounded-lg p-1.5 text-[#8e9182] hover:text-[#bce663] hover:bg-[#bce663]/10 transition-all"
            title="Edytuj listę nawyków"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {habits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2b2d24] p-6 text-center text-xs text-[#5d6050]">
            Brak nawyków. Kliknij ołówek powyżej, żeby dodać pierwszy.
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => {
              const isQty = habit.type === "QUANTITY" || habit.type === "TIME";
              const currentVal = habit.value ?? 0;

              return (
                <div
                  key={habit.id}
                  onClick={() => handleHabitRowClick(habit)}
                  className={`group w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-300 text-left cursor-pointer ${
                    habit.completed
                      ? "border-[#bce663]/30 bg-[#bce663]/5"
                      : "border-[#2b2d24] bg-[#141511] hover:border-[#3d4032]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                        habit.completed
                          ? "border-[#bce663] bg-[#bce663] text-[#0d0e0c]"
                          : "border-[#5d6050] bg-transparent"
                      }`}
                    >
                      {habit.completed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold truncate transition-colors ${
                          habit.completed ? "text-white line-through opacity-70" : "text-[#e2e3d8]"
                        }`}
                      >
                        {habit.name}
                      </p>
                      {isQty && (
                        <p className="text-[10px] text-[#8e9182] mt-0.5">
                          Postęp:{" "}
                          <span className="text-[#e2e3d8] font-semibold">
                            {parseFloat(currentVal.toFixed(2))}
                          </span>{" "}
                          / {habit.targetValue} {habit.unit}
                        </p>
                      )}
                    </div>
                  </div>

                  {isQty && (
                    <div
                      className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(habit, -1);
                        }}
                        className="rounded-md p-1 bg-[#1b1c16] border border-[#2b2d24] text-[#8e9182] hover:text-white transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(habit, 1);
                        }}
                        className="rounded-md p-1 bg-[#1b1c16] border border-[#2b2d24] text-[#bce663] hover:bg-[#bce663]/10 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SUPLEMENTY */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182] flex items-center gap-1.5">
          <Pill className="h-3.5 w-3.5 text-[#bce663]" />
          <span>Suplementy na dziś</span>
        </h3>

        {supplements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2b2d24] p-4 text-center text-xs text-[#5d6050]">
            Brak aktywnych suplementów na ten dzień.
          </div>
        ) : (
          <div className="space-y-2">
            {supplements.map((supp) => {
              return (
                <div
                  key={supp.id}
                  onClick={() => handleSupplementToggle(supp)}
                  className={`group w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-300 text-left cursor-pointer ${
                    supp.completed
                      ? "border-[#bce663]/30 bg-[#bce663]/5"
                      : "border-[#2b2d24] bg-[#141511] hover:border-[#3d4032]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                        supp.completed
                          ? "border-[#bce663] bg-[#bce663] text-[#0d0e0c]"
                          : "border-[#5d6050] bg-transparent"
                      }`}
                    >
                      {supp.completed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold truncate transition-colors ${
                          supp.completed ? "text-white line-through opacity-70" : "text-[#e2e3d8]"
                        }`}
                      >
                        {supp.name}
                      </p>
                      <p className="text-[10px] text-[#8e9182] mt-0.5">
                        {supp.company ? `${supp.company} · ` : ""}
                        {supp.servingSize != null ? `Porcja: ${supp.servingSize} ${supp.servingUnit || ""}` : "1 porcja"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wellness & Sleep (Footer Row) */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div
          onClick={() => setIsMoodOpen(true)}
          className="rounded-xl border border-[#2b2d24] bg-[#141511] p-3 hover:border-[#bce663]/50 transition-all cursor-pointer group flex flex-col justify-between h-24"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Wellness</span>
            <Smile className="h-3.5 w-3.5 text-[#bce663]" />
          </div>
          {wellness ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400 fill-amber-400" /> {wellness.energyScore}/10
                </span>
                <span className="text-xs font-bold text-white flex items-center gap-1">
                  <Smile className="h-3 w-3 text-sky-400 fill-sky-400" /> {wellness.moodScore}/10
                </span>
              </div>
              <p className="text-[9px] text-[#8e9182] truncate">{wellness.notes || "Zapisano"}</p>
            </div>
          ) : (
            <div className="text-[10px] font-bold text-[#bce663] group-hover:underline flex items-center gap-1 animate-pulse">
              <Sparkles className="h-3 w-3" /> Zapisz nastrój
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#2b2d24] bg-[#141511] p-3 flex flex-col justify-between h-24">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Sen z nocy</span>
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          {sleep ? (
            <div>
              <p className="text-base font-extrabold text-white">
                {Math.floor(sleep.totalMinutes / 60)}h {sleep.totalMinutes % 60}m
              </p>
              {sleep.efficiency && (
                <p className="text-[9px] text-[#8e9182] mt-0.5">Wydajność: {Math.round(sleep.efficiency)}%</p>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-[#5d6050]">Brak danych ze snu</div>
          )}
        </div>
      </div>

      <MoodModal
        isOpen={isMoodOpen}
        onClose={() => setIsMoodOpen(false)}
        onSave={() => fetchData(dateStr)}
        initialData={wellness}
        dateStr={dateStr}
      />

      <HabitEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onChanged={() => fetchData(dateStr)}
      />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Activity, Bike,
  Dumbbell, Compass, Calendar, Trash2, CheckCircle, Repeat,
} from "lucide-react";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, addDays, subWeeks, addWeeks,
  subMonths, addMonths, isSameMonth, isSameDay,
} from "date-fns";
import { pl } from "date-fns/locale";
import { Modal } from "@/components/ui/modal";
import WorkoutDetailModal from "@/components/dashboard/workout-detail-modal";

// Helper: konwertuje Date na "YYYY-MM-DD" w lokalnej strefie czasowej (nie UTC)
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface WorkoutSession {
  id: string;
  name: string;
  type: "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "OTHER";
  date: string | Date;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetVolume?: number | null;
  notes?: string | null;
  statuses: { status: string }[];
}

interface ActivitySubtype {
  id: string;
  parentType: string;
  name: string;
}

interface WeeklyPlanProps {
  initialWorkouts: WorkoutSession[];
}

const TYPE_LABELS: Record<string, string> = {
  RUN: "Bieg",
  RIDE: "Rower",
  STRENGTH: "Siła",
  OTHER: "Inne",
};

const TYPE_COLORS: Record<string, string> = {
  RUN: "text-[#bce663]",
  RIDE: "text-sky-400",
  STRENGTH: "text-amber-400",
  OTHER: "text-[#8e9182]",
};

const STATUS_BORDER: Record<string, string> = {
  DONE: "border-[#bce663]/50 bg-[#bce663]/5",
  MISSED: "border-red-500/40 bg-red-500/5",
  PLANNED: "border-[#2b2d24] bg-[#1b1c16]",
  PARTIALLY_DONE: "border-amber-500/40 bg-amber-500/5",
};

export default function WeeklyPlan({ initialWorkouts }: WeeklyPlanProps) {
  const [viewMode, setViewMode] = useState<"WEEK" | "MONTH">("WEEK");
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [workouts, setWorkouts] = useState<WorkoutSession[]>(initialWorkouts);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [subtypes, setSubtypes] = useState<ActivitySubtype[]>([]);
  const [selectedDetailWorkout, setSelectedDetailWorkout] = useState<any | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>("");
  const [modalType, setModalType] = useState<"RUN" | "RIDE" | "STRENGTH" | "OTHER">("RUN");
  const [modalSubtypeId, setModalSubtypeId] = useState<string>("");
  const [modalName, setModalName] = useState("");
  const [modalDistance, setModalDistance] = useState("");
  const [modalDuration, setModalDuration] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const [modalRecurring, setModalRecurring] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // Scope dialog state — appears when user does action on recurring session
  const [scopeDialog, setScopeDialog] = useState<{
    action: "delete" | "move" | null;
    workoutId: string | null;
    targetDate?: string;
  }>({ action: null, workoutId: null });

  // Load subtypes once
  useEffect(() => {
    fetch("/api/settings/dictionaries")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSubtypes(data);
      })
      .catch(() => {});
  }, []);

  const fetchWorkouts = async () => {
    let fromStr = "";
    let toStr = "";
    if (viewMode === "WEEK") {
      fromStr = toLocalDateStr(currentWeekStart);
      toStr = toLocalDateStr(addDays(currentWeekStart, 6));
    } else {
      const monthStart = startOfMonth(currentMonthDate);
      const monthEnd = endOfMonth(monthStart);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      fromStr = toLocalDateStr(gridStart);
      toStr = toLocalDateStr(gridEnd);
    }
    try {
      const res = await fetch(`/api/plan?from=${fromStr}&to=${toStr}`);
      if (res.ok) setWorkouts(await res.json());
    } catch {}
  };

  useEffect(() => { fetchWorkouts(); }, [currentWeekStart, currentMonthDate, viewMode]);

  // Nasłuchuj event'u "plan-changed" (np. zmiana statusu z daily-tasks)
  useEffect(() => {
    const handler = () => fetchWorkouts();
    window.addEventListener("plan-changed", handler);
    return () => window.removeEventListener("plan-changed", handler);
  }, [currentWeekStart, currentMonthDate, viewMode]);

  // Navigation
  const prev = () => viewMode === "WEEK"
    ? setCurrentWeekStart((p) => subWeeks(p, 1))
    : setCurrentMonthDate((p) => subMonths(p, 1));
  const next = () => viewMode === "WEEK"
    ? setCurrentWeekStart((p) => addWeeks(p, 1))
    : setCurrentMonthDate((p) => addMonths(p, 1));
  const today = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setCurrentMonthDate(new Date());
  };

  // Week days
  const weekDays = Array.from({ length: 7 }).map((_, idx) => {
    const day = addDays(currentWeekStart, idx);
    return {
      date: day,
      dateStr: toLocalDateStr(day),
      dayShort: format(day, "eee", { locale: pl }),
      dayNum: format(day, "d"),
    };
  });

  // Month days
  const monthDays = (() => {
    const ms = startOfMonth(currentMonthDate);
    const me = endOfMonth(ms);
    return eachDayOfInterval({
      start: startOfWeek(ms, { weekStartsOn: 1 }),
      end: endOfWeek(me, { weekStartsOn: 1 }),
    }).map((day) => ({
      date: day,
      dateStr: toLocalDateStr(day),
      dayNum: format(day, "d"),
      isCurrentMonth: isSameMonth(day, currentMonthDate),
    }));
  })();

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setActiveDragId(id);
  };
  const handleDragEnd = () => setActiveDragId(null);
  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || activeDragId;
    if (!id) return;
    const workout = workouts.find((w) => w.id === id);
    if (!workout) return;
    // workout.date z DB to ISO string z DB (np. "2026-05-20T00:00:00.000Z").
    // Wyciągamy YYYY-MM-DD bezpośrednio ze stringa — bez konwersji do Date,
    // żeby uniknąć przesunięcia stref czasowych.
    const src = typeof workout.date === "string"
      ? workout.date.slice(0, 10)
      : toLocalDateStr(new Date(workout.date));
    if (src === targetDateStr) return;

    // Recurring? Pytaj o scope.
    if ((workout as any).recurrence === "WEEKLY" && (workout as any).seriesId) {
      setScopeDialog({ action: "move", workoutId: id, targetDate: targetDateStr });
      return;
    }

    await moveWorkout(id, targetDateStr, "single");
  };

  const moveWorkout = async (id: string, targetDateStr: string, scope: "single" | "future") => {
    setWorkouts((prev) => prev.map((w) => w.id === id ? { ...w, date: targetDateStr } : w));
    try {
      await fetch(`/api/plan/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDateStr, scope }),
      });
      window.dispatchEvent(new Event("plan-changed"));
      fetchWorkouts();
    } catch { fetchWorkouts(); }
  };

  const handleDelete = async (id: string) => {
    const workout = workouts.find((w) => w.id === id);
    if (!workout) return;
    if ((workout as any).recurrence === "WEEKLY" && (workout as any).seriesId) {
      setScopeDialog({ action: "delete", workoutId: id });
      return;
    }
    if (!confirm("Usunąć zaplanowany trening?")) return;
    await deleteWorkout(id, "single");
  };

  const deleteWorkout = async (id: string, scope: "single" | "future") => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    try {
      await fetch(`/api/plan/${id}?scope=${scope}`, { method: "DELETE" });
      window.dispatchEvent(new Event("plan-changed"));
      fetchWorkouts();
    } catch { fetchWorkouts(); }
  };

  // Open modal
  const openModal = (dateStr: string) => {
    setModalDate(dateStr);
    setModalType("RUN");
    setModalSubtypeId("");
    setModalName("");
    setModalDistance("");
    setModalDuration("");
    setModalNotes("");
    setModalRecurring(false);
    setModalOpen(true);
  };

  // Filtered subtypes for current type
  const filteredSubtypes = subtypes.filter((s) => s.parentType === modalType);

  // When type changes, reset subtype and name
  const handleTypeChange = (t: typeof modalType) => {
    setModalType(t);
    setModalSubtypeId("");
    setModalName("");
  };

  // When subtype selected, auto-fill name
  const handleSubtypeChange = (id: string) => {
    setModalSubtypeId(id);
    const sub = subtypes.find((s) => s.id === id);
    if (sub) setModalName(`${TYPE_LABELS[modalType]}: ${sub.name}`);
  };

  // Whether current type requires a subtype to be picked (only types with subtypes in dict)
  const needsSubtype = filteredSubtypes.length > 0;

  const canSubmit = modalName.trim().length > 0 && (!needsSubtype || modalSubtypeId.length > 0);

  const handleModalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) return;
    setModalSaving(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: modalDate,
          type: modalType,
          name: modalName.trim(),
          targetDistance: modalDistance ? parseFloat(modalDistance) * 1000 : null,
          targetDuration: modalDuration ? parseInt(modalDuration) * 60 : null,
          notes: modalNotes || null,
          recurrence: modalRecurring ? "WEEKLY" : "NONE",
          recurrenceWeeks: 12,
        }),
      });
      if (res.ok) {
        setModalOpen(false);
        window.dispatchEvent(new Event("plan-changed"));
        fetchWorkouts();
      }
    } catch {}
    setModalSaving(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "RUN": return <Activity className="h-3.5 w-3.5 text-[#bce663]" />;
      case "RIDE": return <Bike className="h-3.5 w-3.5 text-sky-400" />;
      case "STRENGTH": return <Dumbbell className="h-3.5 w-3.5 text-amber-400" />;
      default: return <Compass className="h-3.5 w-3.5 text-[#8e9182]" />;
    }
  };

  const getWorkoutsForDay = (dateStr: string) =>
    workouts.filter((w) => {
      // workout.date z DB przychodzi jako ISO string ("2026-05-20T00:00:00.000Z")
      // — bierzemy YYYY-MM-DD bezpośrednio bez konwersji na Date
      const d = typeof w.date === "string"
        ? w.date.slice(0, 10)
        : toLocalDateStr(new Date(w.date));
      return d === dateStr;
    });

  const todayStr = toLocalDateStr(new Date());

  return (
    <>
      <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2b2d24]/50 pb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#bce663]" />
              Plan Treningowy Tygodnia
            </h2>
            <p className="text-xs text-[#8e9182] mt-0.5">Łap i przenoś sesje treningowe (Drag & Drop)</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-xl border border-[#2b2d24] bg-[#141511] p-0.5 text-[10px] font-bold">
              {(["WEEK", "MONTH"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    viewMode === m ? "bg-[#bce663] text-[#0d0e0c]" : "text-[#8e9182] hover:text-white"
                  }`}
                >
                  {m === "WEEK" ? "Tydzień" : "Miesiąc"}
                </button>
              ))}
            </div>

            <button
              onClick={today}
              className="rounded-xl border border-[#2b2d24] bg-[#141511] px-3 py-1.5 text-[10px] font-bold text-white hover:border-[#bce663]/30 transition-all"
            >
              Dzisiaj
            </button>

            <div className="flex items-center rounded-xl border border-[#2b2d24] bg-[#141511] p-0.5">
              <button onClick={prev} className="rounded-lg p-1.5 text-[#8e9182] hover:text-white hover:bg-[#1f2119] transition-all">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-bold text-white px-3 min-w-[140px] text-center capitalize">
                {viewMode === "WEEK"
                  ? `${format(weekDays[0].date, "d MMM", { locale: pl })} - ${format(weekDays[6].date, "d MMM yyyy", { locale: pl })}`
                  : format(currentMonthDate, "LLLL yyyy", { locale: pl }).replace(/^\w/, (c) => c.toUpperCase())}
              </span>
              <button onClick={next} className="rounded-lg p-1.5 text-[#8e9182] hover:text-white hover:bg-[#1f2119] transition-all">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Week view */}
        {viewMode === "WEEK" && (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayWorkouts = getWorkoutsForDay(day.dateStr);
              const isToday = day.dateStr === todayStr;

              return (
                <div
                  key={day.dateStr}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, day.dateStr)}
                  className={`flex flex-col rounded-xl border p-2.5 min-h-[200px] transition-all ${
                    isToday
                      ? "border-[#bce663]/40 bg-[#bce663]/5"
                      : "border-[#2b2d24] bg-[#141511]/40 hover:border-[#2b2d24]/80"
                  }`}
                >
                  {/* Day header */}
                  <div className="flex items-baseline justify-between pb-2 mb-2 border-b border-[#2b2d24]/50">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182] capitalize">
                      {day.dayShort}
                    </span>
                    <span className={`text-xs font-black h-5 w-5 rounded-full flex items-center justify-center ${
                      isToday ? "bg-[#bce663] text-[#0d0e0c]" : "text-white"
                    }`}>
                      {day.dayNum}
                    </span>
                  </div>

                  {/* Workouts */}
                  <div className="flex-1 space-y-1.5">
                    {dayWorkouts.map((w) => {
                      const status = w.statuses[0]?.status ?? "PLANNED";
                      const isDone = status === "DONE";
                      return (
                        <div
                          key={w.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, w.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedDetailWorkout(w)}
                          className={`group relative flex flex-col gap-1 p-2 rounded-lg border cursor-pointer hover:border-[#bce663]/40 active:scale-[0.96] transition-all ${
                            STATUS_BORDER[status] ?? STATUS_BORDER.PLANNED
                          } ${activeDragId === w.id ? "opacity-30" : ""}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(w.id);
                            }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 rounded p-0.5 text-[#5d6050] hover:text-red-400 hover:bg-red-500/10 transition-all z-10"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>

                          <div className="flex items-center gap-1.5">
                            {getIcon(w.type)}
                            {isDone && <CheckCircle className="h-3 w-3 text-[#bce663]" />}
                            {(w as any).recurrence === "WEEKLY" && (
                              <Repeat className="h-2.5 w-2.5 text-[#8e9182]" />
                            )}
                          </div>

                          <p className={`text-[10px] font-bold text-[#e2e3d8] leading-tight pr-3 ${
                            isDone ? "line-through opacity-60" : ""
                          }`}>
                            {w.name}
                          </p>

                          {(w.targetDistance || w.targetDuration) && (
                            <div className="flex items-center gap-1.5 text-[9px] text-[#8e9182]">
                              {w.targetDistance && <span>{(w.targetDistance / 1000).toFixed(1)} km</span>}
                              {w.targetDuration && <span>{Math.round(w.targetDuration / 60)} min</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {dayWorkouts.length === 0 && (
                      <div className="flex-1 flex items-center justify-center py-4">
                        <p className="text-[9px] text-[#5d6050] italic">Brak sesji</p>
                      </div>
                    )}
                  </div>

                  {/* Add button */}
                  <button
                    onClick={() => openModal(day.dateStr)}
                    className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#2b2d24] py-1.5 text-[9px] text-[#8e9182] hover:border-[#bce663] hover:text-white transition-all w-full"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Zaplanuj</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Month view */}
        {viewMode === "MONTH" && (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1.5 text-center border-b border-[#2b2d24]/50 pb-2">
              {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map((d) => (
                <div key={d} className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((day) => {
                const dayWorkouts = getWorkoutsForDay(day.dateStr);
                const isToday = day.dateStr === todayStr;
                return (
                  <div
                    key={day.dateStr}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, day.dateStr)}
                    className={`group relative flex flex-col rounded-xl border p-1.5 min-h-[90px] transition-all ${
                      isToday ? "border-[#bce663]/40 bg-[#bce663]/5" : "border-[#2b2d24] bg-[#141511]/30"
                    } ${!day.isCurrentMonth ? "opacity-30" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center ${
                        isToday ? "bg-[#bce663] text-[#0d0e0c]" : "text-white"
                      }`}>{day.dayNum}</span>
                      <button
                        onClick={() => openModal(day.dateStr)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#8e9182] hover:text-[#bce663]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayWorkouts.slice(0, 3).map((w) => (
                        <div
                          key={w.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, w.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setSelectedDetailWorkout(w)}
                          className="flex items-center gap-1 px-1 py-0.5 rounded border border-[#2b2d24] bg-[#1b1c16] text-[8px] cursor-pointer hover:border-[#bce663]/40 active:scale-[0.98] transition-all"
                        >
                          {getIcon(w.type)}
                          <span className="truncate text-[#e2e3d8] font-bold">{w.name}</span>
                        </div>
                      ))}
                      {dayWorkouts.length > 3 && (
                        <p className="text-[8px] text-[#5d6050] pl-1">+{dayWorkouts.length - 3} więcej</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Plan Modal ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Zaplanuj trening"
        description={modalDate ? `Data: ${format(new Date(modalDate), "EEEE, d MMMM yyyy", { locale: pl })}` : ""}
        size="md"
      >
        <form onSubmit={handleModalSave} className="space-y-4">
          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">Typ treningu</label>
            <div className="grid grid-cols-4 gap-2">
              {(["RUN", "RIDE", "STRENGTH", "OTHER"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                    modalType === t
                      ? "border-[#bce663] bg-[#bce663]/10 text-[#bce663]"
                      : "border-[#2b2d24] bg-[#141511] text-[#8e9182] hover:border-[#3d4032] hover:text-white"
                  }`}
                >
                  {t === "RUN" && <Activity className="h-4 w-4" />}
                  {t === "RIDE" && <Bike className="h-4 w-4" />}
                  {t === "STRENGTH" && <Dumbbell className="h-4 w-4" />}
                  {t === "OTHER" && <Compass className="h-4 w-4" />}
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Subtype selector (lub fallback name input) */}
          {needsSubtype ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">
                Rodzaj {TYPE_LABELS[modalType].toLowerCase()}
              </label>
              <div className="flex flex-wrap gap-2">
                {filteredSubtypes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSubtypeChange(s.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      modalSubtypeId === s.id
                        ? "border-[#bce663] bg-[#bce663]/10 text-[#bce663]"
                        : "border-[#2b2d24] bg-[#141511] text-[#8e9182] hover:border-[#3d4032] hover:text-white"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {modalSubtypeId && (
                <p className="text-[10px] text-[#8e9182] mt-1">
                  Sesja: <span className="text-[#bce663] font-bold">{modalName}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">
                Nazwa sesji
              </label>
              <input
                type="text"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder={`np. ${TYPE_LABELS[modalType]}`}
                required
                className="w-full bg-[#141511] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5d6050] outline-none transition-colors"
              />
              <p className="text-[10px] text-[#5d6050]">
                Brak podtypów dla "{TYPE_LABELS[modalType]}". Możesz dodać je w Ustawieniach → Słowniki.
              </p>
            </div>
          )}

          {/* Params row */}
          <div className="grid grid-cols-2 gap-3">
            {(modalType === "RUN" || modalType === "RIDE") && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">Dystans (km)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={modalDistance}
                  onChange={(e) => setModalDistance(e.target.value)}
                  placeholder="np. 10"
                  className="w-full bg-[#141511] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5d6050] outline-none transition-colors font-mono"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">Czas (min)</label>
              <input
                type="number"
                min="0"
                value={modalDuration}
                onChange={(e) => setModalDuration(e.target.value)}
                placeholder="np. 60"
                className="w-full bg-[#141511] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5d6050] outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#8e9182] uppercase tracking-wider">Notatka (opcjonalnie)</label>
            <textarea
              value={modalNotes}
              onChange={(e) => setModalNotes(e.target.value)}
              placeholder="Dodatkowe informacje o treningu..."
              rows={2}
              className="w-full bg-[#141511] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5d6050] outline-none transition-colors resize-none"
            />
          </div>

          {/* Recurring */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-[#2b2d24] bg-[#141511] cursor-pointer hover:border-[#3d4032] transition-all">
            <input
              type="checkbox"
              checked={modalRecurring}
              onChange={(e) => setModalRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-[#3d4032] bg-[#0d0e0c] text-[#bce663] focus:ring-[#bce663] focus:ring-offset-0"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-white">Powtarzaj co tydzień</p>
              <p className="text-[10px] text-[#8e9182] mt-0.5">
                Utworzy 12 sesji w przyszłość, w ten sam dzień tygodnia.
              </p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 rounded-xl border border-[#2b2d24] bg-transparent py-2.5 text-xs font-bold text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-all"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={modalSaving || !canSubmit}
              className="flex-1 rounded-xl bg-[#bce663] py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
            >
              {modalSaving ? "Zapisywanie..." : "Zaplanuj trening"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Scope Dialog (recurring) ────────────────────────────────────── */}
      <Modal
        isOpen={scopeDialog.action !== null}
        onClose={() => setScopeDialog({ action: null, workoutId: null })}
        title={scopeDialog.action === "delete" ? "Usuń trening" : "Przenieś trening"}
        description="To trening cykliczny. Wybierz, jak ma działać zmiana."
        size="md"
      >
        <div className="space-y-3">
          <button
            onClick={async () => {
              if (!scopeDialog.workoutId) return;
              if (scopeDialog.action === "delete") {
                await deleteWorkout(scopeDialog.workoutId, "single");
              } else if (scopeDialog.action === "move" && scopeDialog.targetDate) {
                await moveWorkout(scopeDialog.workoutId, scopeDialog.targetDate, "single");
              }
              setScopeDialog({ action: null, workoutId: null });
            }}
            className="w-full text-left p-4 rounded-xl border border-[#2b2d24] bg-[#141511] hover:border-[#bce663] hover:bg-[#bce663]/5 transition-all"
          >
            <p className="text-sm font-bold text-white">Tylko ten trening</p>
            <p className="text-[11px] text-[#8e9182] mt-1">
              Zmiana dotyczy wyłącznie tego wystąpienia. Pozostałe w serii się nie zmienią.
            </p>
          </button>

          <button
            onClick={async () => {
              if (!scopeDialog.workoutId) return;
              if (scopeDialog.action === "delete") {
                await deleteWorkout(scopeDialog.workoutId, "future");
              } else if (scopeDialog.action === "move" && scopeDialog.targetDate) {
                // Przesunięcie "future" przesuwa tylko jedno wystąpienie (data per-occurrence),
                // ale traktujemy to jako odpięcie od serii (jak w Google Calendar).
                await moveWorkout(scopeDialog.workoutId, scopeDialog.targetDate, "single");
              }
              setScopeDialog({ action: null, workoutId: null });
            }}
            className="w-full text-left p-4 rounded-xl border border-[#2b2d24] bg-[#141511] hover:border-red-500/50 hover:bg-red-500/5 transition-all"
          >
            <p className="text-sm font-bold text-white">
              {scopeDialog.action === "delete" ? "Ten i wszystkie przyszłe" : "Ten i wszystkie przyszłe (tylko usunięcie)"}
            </p>
            <p className="text-[11px] text-[#8e9182] mt-1">
              {scopeDialog.action === "delete"
                ? "Usunie ten trening oraz wszystkie kolejne wystąpienia w tej serii."
                : "Przeniesienie pojedynczego dnia w serii nie ma sensu — użyj edycji aby zmienić wszystkie."}
            </p>
          </button>

          <button
            onClick={() => setScopeDialog({ action: null, workoutId: null })}
            className="w-full p-3 rounded-xl border border-[#2b2d24] text-xs font-bold text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-all"
          >
            Anuluj
          </button>
        </div>
      </Modal>

      <WorkoutDetailModal
        workout={selectedDetailWorkout}
        onClose={() => setSelectedDetailWorkout(null)}
      />
    </>
  );
}

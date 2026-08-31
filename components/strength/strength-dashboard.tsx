"use client";

import { useState, useMemo, useEffect } from "react";
import { MuscleGroup, muscleGroupLabels } from "@/lib/services/muscle-groups";
import BodyMap from "./body-map";
import RecordsGrid, { RecordData } from "./records-grid";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { 
  Trophy, Clock, Weight, ChevronDown, ChevronUp, Search, 
  Filter, Dumbbell, TrendingUp, Plus, Upload, X, Trash2
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface SetData {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  duration: number | null;
  isPr: boolean;
  e1RM: number;
}

interface ExerciseData {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  type: "REPS_WEIGHT" | "REPS_ONLY" | "DURATION";
  sets: SetData[];
  bestE1RM: number;
  progressFromBaseline: number | null;
}

interface WorkoutData {
  id: string;
  name: string;
  startedAt: string;
  duration: number | null;
  volume: number;
  moodScore: number | null;
  exercises: ExerciseData[];
}

interface StrengthDashboardProps {
  initialWorkouts: WorkoutData[];
  initialMuscleVolumes: Record<MuscleGroup, number>;
  muscleSetCounts: Record<'week' | 'month' | 'year' | 'all', Record<MuscleGroup, number>>;
  initialRecords: Partial<Record<MuscleGroup, RecordData>>;
  totalWorkouts: number;
  totalVolume: number;
  totalPrs: number;
  weeklyVolumeData: { weekLabel: string; volume: number }[];
}

export default function StrengthDashboard({
  initialWorkouts,
  initialMuscleVolumes,
  muscleSetCounts,
  initialRecords,
  totalWorkouts,
  totalVolume,
  totalPrs,
  weeklyVolumeData
}: StrengthDashboardProps) {
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"ALL" | "PUSH" | "PULL" | "LEGS" | "CORE">("ALL");

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [updatingExerciseName, setUpdatingExerciseName] = useState<string | null>(null);

  const handleReassignMuscleGroup = async (exerciseName: string, muscleGroup: MuscleGroup) => {
    setUpdatingExerciseName(exerciseName);
    try {
      const res = await fetch("/api/exercises/reassign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseName, muscleGroup }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd przypisywania");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Wystąpił błąd");
    } finally {
      setUpdatingExerciseName(null);
    }
  };

  // Prevent browser from opening dragged images in a new tab when dropping
  useEffect(() => {
    if (!uploadOpen) return;
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, [uploadOpen]);

  // Formatowanie czasu trwania
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const toggleWorkout = (id: string) => {
    setExpandedWorkouts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectGroup = (group: MuscleGroup | null) => {
    setSelectedGroup(group);
  };

  // Upload handlers
  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    setUploadPreview(null);
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleAnalyze = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("saveMode", "preview");
      const res = await fetch("/api/strength/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd analizy");
      setUploadPreview(json.data);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSave = async () => {
    if (!uploadPreview) return;
    setUploadSaving(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/strength/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          saveMode: "save",
          workoutData: uploadPreview
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd zapisu");
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadOpen(false);
        setUploadFile(null);
        setUploadPreview(null);
        setUploadSuccess(false);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploadSaving(false);
    }
  };

  const handleMuscleGroupChange = (exerciseIndex: number, newGroup: MuscleGroup) => {
    if (!uploadPreview) return;
    const updatedExercises = [...uploadPreview.exercises];
    updatedExercises[exerciseIndex] = {
      ...updatedExercises[exerciseIndex],
      muscleGroup: newGroup
    };
    setUploadPreview({
      ...uploadPreview,
      exercises: updatedExercises
    });
  };

  // Filtrowanie treningów
  const filteredWorkouts = useMemo(() => {
    return initialWorkouts.filter(workout => {
      // 1. Filtrowanie po wybranej partii z mapy ciała
      if (selectedGroup) {
        const hasGroup = workout.exercises.some(e => e.muscleGroup === selectedGroup);
        if (!hasGroup) return false;
      }

      // 2. Filtrowanie po typie (Tab)
      if (activeTab !== "ALL") {
        const hasMatchingGroup = workout.exercises.some(e => {
          if (activeTab === "PUSH") {
            return e.muscleGroup === "CHEST" || e.muscleGroup === "SHOULDERS" || e.muscleGroup === "TRICEPS";
          }
          if (activeTab === "PULL") {
            return e.muscleGroup === "BACK" || e.muscleGroup === "BICEPS" || e.muscleGroup === "FOREARMS";
          }
          if (activeTab === "LEGS") {
            return e.muscleGroup === "LEGS" || e.muscleGroup === "CALVES";
          }
          if (activeTab === "CORE") {
            return e.muscleGroup === "CORE";
          }
          return false;
        });
        if (!hasMatchingGroup) return false;
      }

      // 3. Wyszukiwarka tekstowa
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesName = workout.name.toLowerCase().includes(query);
        const matchesExercise = workout.exercises.some(e => e.name.toLowerCase().includes(query));
        if (!matchesName && !matchesExercise) return false;
      }

      return true;
    });
  }, [initialWorkouts, selectedGroup, activeTab, searchQuery]);

  // Maksymalny tonaż do skalowania wykresu SVG
  const maxWeeklyVolume = useMemo(() => {
    return Math.max(...weeklyVolumeData.map(d => d.volume), 1000);
  }, [weeklyVolumeData]);

  return (
    <div className="space-y-6 text-white">
      {/* NAGŁÓWEK — wzorzec globalny */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2b2d24] pb-5">
        <div>
          <p className="text-[10px] font-mono text-[#5d6050] mb-1">HealthOS / Siła</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Siła</h1>
          <p className="text-sm text-[#8e9182] mt-1">
            Interaktywna mapa ciała, rekordy życiowe i historia treningów siłowych.
          </p>
        </div>

        <button
          onClick={() => { setUploadOpen(true); setUploadFile(null); setUploadPreview(null); setUploadError(null); setUploadSuccess(false); }}
          className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] transition-all shrink-0"
        >
          <Plus className="h-4 w-4" />
          Dodaj trening
        </button>
      </div>

      {/* GŁÓWNA SIATKA (DWUKOLUMNOWA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEWA KOLUMNA: MAPA CIAŁA + WYKRES TONAŻU (Lg: 5/12) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Mapa Ciała */}
          <BodyMap 
            selectedGroup={selectedGroup} 
            onSelectGroup={handleSelectGroup}
            muscleVolumes={initialMuscleVolumes}
            muscleSetCounts={muscleSetCounts}
          />

          {/* Wykres Tonażu 12-Tygodniowego (Piękne SVG) */}
          <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg flex flex-col justify-between h-[230px]">
            <div className="flex items-center justify-between border-b border-[#2b2d24] pb-3 mb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182]">Objętość treningowa (Tonaż)</h3>
                <p className="text-[10px] text-[#5d6050]">Ostatnie 12 tygodni · tonaż (kg × powt.)</p>
              </div>
              <Weight className="h-3.5 w-3.5 text-[#5d6050]" />
            </div>

            {/* Wykres Słupkowy SVG */}
            <div className="flex-1 w-full relative mt-3 select-none h-[120px]">
              <svg className="w-full h-full" viewBox="0 0 420 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bce663" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#bce663" stopOpacity="0.15" />
                  </linearGradient>
                  <linearGradient id="barGradActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bce663" stopOpacity="1" />
                    <stop offset="100%" stopColor="#bce663" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                {/* Linie pomocnicze siatki w tle */}
                <line x1="0" y1="20" x2="420" y2="20" stroke="#2b2d24" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1="50" x2="420" y2="50" stroke="#2b2d24" strokeWidth="0.5" strokeDasharray="3 3" />
                <line x1="0" y1="80" x2="420" y2="80" stroke="#2b2d24" strokeWidth="0.5" strokeDasharray="3 3" />

                {weeklyVolumeData.map((d, index) => {
                  const barWidth = 20;
                  const gap = 12;
                  const startX = 20 + index * (barWidth + gap);
                  
                  // Wysokość słupka (max 75px, min 3px dla zerowego, aby ładnie wyglądało)
                  const rawHeight = (d.volume / maxWeeklyVolume) * 75;
                  const barHeight = Math.max(rawHeight, 3);
                  const y = 80 - barHeight;

                  return (
                    <g key={d.weekLabel} className="group/bar cursor-pointer">
                      {/* Słupek tonażu */}
                      <rect
                        x={startX}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="3"
                        fill="url(#barGrad)"
                        className="transition-all duration-200 group-hover/bar:fill-[url(#barGradActive)]"
                      />
                      
                      {/* Tooltip tonażu na hover (premium SVG overlay) */}
                      <text
                        x={startX + barWidth / 2}
                        y={y - 6}
                        textAnchor="middle"
                        fill="#bce663"
                        fontSize="7"
                        fontWeight="black"
                        className="opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200"
                      >
                        {d.volume >= 1000 ? `${(d.volume / 1000).toFixed(1)}t` : `${Math.round(d.volume)}kg`}
                      </text>

                      {/* Etykieta tygodnia */}
                      <text
                        x={startX + barWidth / 2}
                        y="92"
                        textAnchor="middle"
                        fill="#5d6050"
                        fontSize="7"
                        fontWeight="bold"
                        className="group-hover/bar:fill-[#bce663] transition-colors duration-200"
                      >
                        {d.weekLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* PRAWA KOLUMNA: REKORDY PER PARTIA (Lg: 7/12) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18]/50 p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#2b2d24] pb-3 mb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182]">Rekordy Życiowe</h3>
                <p className="text-[10px] text-[#5d6050]">Najlepsze ćwiczenie i szacowane 1RM dla 6 kluczowych partii</p>
              </div>
              <Trophy className="h-3.5 w-3.5 text-[#bce663]" />
            </div>
            
            <RecordsGrid records={initialRecords} />
          </div>
        </div>

      </div>

      {/* DÓŁ: FILTRY I TABELA HISTORII TRENINGÓW */}
      <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-4 mt-6">
        
        {/* Pasek Filtrów */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 border-b border-[#2b2d24] pb-4">
          <div className="flex items-center gap-2.5">
            <Filter className="h-3.5 w-3.5 text-[#8e9182]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e9182]">Historia Treningów</h3>
            {selectedGroup && (
              <span className="text-[9px] font-bold uppercase text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 px-2 py-0.5 rounded flex items-center gap-1.5 animate-pulse">
                Filtrowanie: {muscleGroupLabels[selectedGroup]}
                <button 
                  onClick={() => setSelectedGroup(null)}
                  className="hover:text-white font-bold ml-0.5 text-[8px]"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          {/* Szybkie Zakładki (Push/Pull/Legs) */}
          <div className="flex items-center bg-[#141511] border border-[#2b2d24] rounded-lg p-0.5 self-start">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
                activeTab === "ALL" 
                  ? "bg-[#bce663] text-black" 
                  : "text-[#8e9182] hover:text-white"
              }`}
            >
              Wszystko
            </button>
            <button
              onClick={() => setActiveTab("PUSH")}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
                activeTab === "PUSH" 
                  ? "bg-[#bce663] text-black" 
                  : "text-[#8e9182] hover:text-white"
              }`}
            >
              Push
            </button>
            <button
              onClick={() => setActiveTab("PULL")}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
                activeTab === "PULL" 
                  ? "bg-[#bce663] text-black" 
                  : "text-[#8e9182] hover:text-white"
              }`}
            >
              Pull
            </button>
            <button
              onClick={() => setActiveTab("LEGS")}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
                activeTab === "LEGS" 
                  ? "bg-[#bce663] text-black" 
                  : "text-[#8e9182] hover:text-white"
              }`}
            >
              Uda
            </button>
            <button
              onClick={() => setActiveTab("CORE")}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 ${
                activeTab === "CORE" 
                  ? "bg-[#bce663] text-black" 
                  : "text-[#8e9182] hover:text-white"
              }`}
            >
              Core
            </button>
          </div>

          {/* Wyszukiwarka */}
          <div className="relative md:w-60">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-[#5d6050]" />
            </span>
            <input
              type="text"
              placeholder="Szukaj treningu lub ćwiczenia..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#141511] border border-[#2b2d24] focus:border-[#bce663]/40 rounded-xl pl-9 pr-4 py-1.5 text-xs font-medium placeholder-[#5d6050] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Tabela / Lista Treningów (Premium Accordion Style) */}
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-16 text-[#5d6050] flex flex-col items-center">
            <Dumbbell className="h-10 w-10 mb-3 opacity-30 text-[#8e9182]" />
            <p className="text-xs font-bold uppercase tracking-wider">Brak dopasowanych treningów</p>
            <p className="text-[10px] text-[#42443a] mt-1">
              Spróbuj zresetować filtry lub wyszukać coś innego.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorkouts.map((workout, idx) => {
              const isOpen = !!expandedWorkouts[workout.id];
              const dateObj = new Date(workout.startedAt);
              const hasPr = workout.exercises.some(e => e.sets.some(s => s.isPr));

              // Month separator
              const currentMonth = format(dateObj, "LLLL yyyy", { locale: pl });
              const prevWorkout = filteredWorkouts[idx - 1];
              const prevMonth = prevWorkout
                ? format(new Date(prevWorkout.startedAt), "LLLL yyyy", { locale: pl })
                : null;
              const showMonthSeparator = idx === 0 || currentMonth !== prevMonth;

              return (
                <div key={workout.id}>
                  {/* Month separator */}
                  {showMonthSeparator && (
                    <div className="flex items-center gap-3 py-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#bce663]">
                        {currentMonth.replace(/^\w/, (c) => c.toUpperCase())}
                      </span>
                      <div className="flex-1 h-px bg-[#2b2d24]" />
                    </div>
                  )}
                <div 
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen 
                      ? "border-[#bce663]/30 bg-[#1a1c18]" 
                      : "border-[#2b2d24] bg-[#141511] hover:border-[#2b2d24]/80 hover:bg-[#1a1c18]/40"
                  }`}
                >
                  {/* Wiersz nagłówka treningu */}
                  <div 
                    onClick={() => toggleWorkout(workout.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${
                        isOpen 
                          ? "bg-[#bce663]/10 border-[#bce663]/20 text-[#bce663]" 
                          : "bg-[#1a1c18] border-[#2b2d24] text-[#8e9182]"
                      }`}>
                        <Dumbbell className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-white">
                            {workout.name}
                          </p>
                          {hasPr && (
                            <span className="flex items-center gap-0.5 text-[8px] font-black uppercase text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 px-1.5 py-0.5 rounded">
                              <Trophy className="h-2 w-2 text-[#bce663]" /> PR
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#5d6050] font-mono capitalize mt-0.5">
                          {format(dateObj, "EEEE, d MMMM yyyy, HH:mm", { locale: pl })}
                        </p>
                      </div>
                    </div>

                    {/* Metryki Treningu */}
                    <div className="flex items-center gap-5 justify-between sm:justify-end border-t border-[#2b2d24] pt-2 sm:border-0 sm:pt-0">
                      <div className="flex items-center gap-4 text-xs font-mono text-[#8e9182]">
                        {workout.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-[#5d6050]" />
                            <span>{formatDuration(workout.duration)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Weight className="h-3.5 w-3.5 text-[#5d6050]" />
                          <span className="font-bold text-white">
                            {workout.volume >= 1000
                              ? `${(workout.volume / 1000).toFixed(2)}t`
                              : `${Math.round(workout.volume)}kg`}
                          </span>
                        </div>
                        {workout.moodScore && (
                          <div className="flex items-center gap-0.5 text-yellow-500">
                            <span>★</span>
                            <span className="font-bold text-white">{workout.moodScore}/5</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm("Czy na pewno chcesz usunąć ten trening wraz ze wszystkimi powiązanymi seriami? Ta operacja jest nieodwracalna.")) {
                              try {
                                const res = await fetch(`/api/strength/${workout.id}`, { method: "DELETE" });
                                if (!res.ok) throw new Error("Błąd podczas usuwania");
                                window.location.reload();
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }
                          }}
                          className="p-1.5 rounded-lg text-[#5d6050] hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Usuń trening"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="text-[#8e9182]">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rozwijana zawartość: Szczegóły ćwiczeń */}
                  {isOpen && (
                    <div className="border-t border-[#2b2d24]/50 bg-[#141511]/40 p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {workout.exercises.map((exercise) => {
                          const hasExPr = exercise.sets.some(s => s.isPr);

                          return (
                            <div 
                              key={exercise.id}
                              className="rounded-xl border border-[#2b2d24] bg-[#1a1c18]/30 p-3 flex flex-col justify-between"
                            >
                              {/* Nazwa ćwiczenia i kategoria */}
                              <div className="flex items-start justify-between gap-2 border-b border-[#2b2d24]/60 pb-2 mb-2">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-white truncate max-w-[180px]">
                                      {exercise.name}
                                    </span>
                                    {hasExPr && <Trophy className="h-3 w-3 text-[#bce663] shrink-0" />}
                                  </div>
                                  {updatingExerciseName === exercise.name ? (
                                    <span className="text-[8px] font-black uppercase text-[#bce663] animate-pulse tracking-wider">
                                      Zapisywanie...
                                    </span>
                                  ) : (
                                    <div className="relative inline-block mt-0.5">
                                      <select
                                        value={exercise.muscleGroup}
                                        onChange={async (e) => {
                                          const val = e.target.value as MuscleGroup;
                                          if (val !== exercise.muscleGroup) {
                                            await handleReassignMuscleGroup(exercise.name, val);
                                          }
                                        }}
                                        className={`appearance-none bg-transparent rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider outline-none cursor-pointer transition-all border ${
                                          exercise.muscleGroup === "OTHER"
                                            ? "text-[#bce663] bg-[#bce663]/5 border-dashed border-[#bce663]/40 hover:border-[#bce663]/80 hover:bg-[#bce663]/10"
                                            : "text-[#8e9182] border-transparent hover:border-[#2b2d24] hover:bg-[#2b2d24]/40"
                                        }`}
                                        title="Zmień partię mięśniową dla tego ćwiczenia"
                                      >
                                        {Object.entries(muscleGroupLabels).map(([key, label]) => (
                                          <option key={key} value={key} className="bg-[#141511] text-white normal-case">
                                            {label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                {/* Wskaźnik Progresu (Baseline) */}
                                {exercise.progressFromBaseline !== null && (
                                  <div className={`text-[9px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded ${
                                    exercise.progressFromBaseline > 0
                                      ? "text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20"
                                      : exercise.progressFromBaseline < 0
                                      ? "text-red-400 bg-red-400/10 border border-red-400/20"
                                      : "text-[#8e9182] bg-[#1a1c18] border border-[#2b2d24]"
                                  }`}>
                                    <TrendingUp className={`h-2.5 w-2.5 ${exercise.progressFromBaseline < 0 ? "rotate-180" : ""}`} />
                                    <span>
                                      {exercise.progressFromBaseline > 0 ? "+" : ""}
                                      {exercise.progressFromBaseline.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Serie */}
                              <div className="space-y-1.5">
                                {exercise.sets.map((set) => {
                                  const formatSetDuration = (sec: number | null) => {
                                    if (!sec) return "0s";
                                    const minutes = Math.floor(sec / 60);
                                    const remainingSec = sec % 60;
                                    if (minutes > 0) {
                                      return remainingSec > 0 ? `${minutes} min ${remainingSec}s` : `${minutes} min`;
                                    }
                                    return `${sec}s`;
                                  };

                                  return (
                                    <div 
                                      key={set.id}
                                      className="flex items-center justify-between text-[10px] font-mono border-b border-[#2b2d24]/20 pb-1"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-[#5d6050] font-bold">#{set.setNumber}</span>
                                        {exercise.type === "DURATION" ? (
                                          <span className="text-white font-bold">{formatSetDuration(set.duration)}</span>
                                        ) : exercise.type === "REPS_ONLY" ? (
                                          <span className="text-white font-bold">{set.reps ?? 0} powt.</span>
                                        ) : (
                                          <>
                                            <span className="text-white font-bold">{set.weight ?? 0} kg</span>
                                            <span className="text-[#8e9182]">×</span>
                                            <span className="text-white">{set.reps ?? 0} powt.</span>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {set.isPr && (
                                          <span className="text-[8px] font-black uppercase text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 px-1 rounded animate-pulse">
                                            PR
                                          </span>
                                        )}
                                        {exercise.type === "REPS_WEIGHT" && set.e1RM > 0 && (
                                          <span className="text-[#5d6050]">
                                            e1RM: <strong className="text-[#8e9182]">{set.e1RM.toFixed(1)}kg</strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

           <Modal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Dodaj trening z Gymlify"
        description="Wgraj zdjęcie raportu z Gymlify — AI przeanalizuje i zapisze trening."
        size="3xl"
      >
        {uploadSuccess ? (
          <div className="py-12 text-center space-y-3">
            <div className="text-5xl text-[#bce663] animate-bounce">✓</div>
            <p className="text-base font-bold text-[#bce663]">Trening zapisany pomyślnie!</p>
            <p className="text-xs text-[#8e9182]">Strona odświeży się za chwilę...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dropzone */}
            {!uploadFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) {
                    handleFileSelect(file);
                  }
                }}
                className="w-full"
              >
                <label className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#bce663] bg-[#bce663]/5 scale-[1.01] shadow-[0_0_25px_rgba(188,230,99,0.15)]"
                    : "border-[#2b2d24] bg-[#141511] hover:border-[#bce663]/50"
                }`}>
                  <Upload className={`h-10 w-10 transition-colors ${isDragging ? "text-[#bce663]" : "text-[#5d6050]"}`} />
                  <div className="text-center">
                    <p className="text-base font-bold text-white">Przeciągnij zdjęcie lub kliknij</p>
                    <p className="text-xs text-[#8e9182] mt-1.5">Raport z Gymlify, Hevy lub inne (PNG, JPG)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-xl border border-[#2b2d24] bg-[#141511]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{uploadFile.name}</p>
                  <p className="text-xs text-[#8e9182]">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                  className="p-2 rounded-lg text-[#8e9182] hover:text-white hover:bg-[#2b2d24] transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            {uploadError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {uploadError}
              </p>
            )}

            {/* Preview */}
            {uploadPreview && (
              <div className="rounded-xl border border-[#2b2d24] bg-[#141511] p-6 space-y-6 max-h-[60vh] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-[#2b2d24]">
                <div className="flex items-center justify-between border-b border-[#2b2d24] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#bce663]">
                      {uploadPreview.workoutName ?? "Przeanalizowany trening"}
                    </h3>
                    <p className="text-xs text-[#8e9182] mt-1">
                      Data treningu: <span className="text-white font-mono">{uploadPreview.date ?? "Nieznana"}</span>
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#bce663] bg-[#bce663]/10 border border-[#bce663]/20 px-3.5 py-1.5 rounded-full shrink-0">
                    {uploadPreview.exercises?.length ?? 0} ćwiczeń
                  </span>
                </div>

                <div className="divide-y divide-[#2b2d24]/50 space-y-5">
                  {uploadPreview.exercises?.map((ex: any, i: number) => {
                    const formatPreviewDuration = (sec: number | null) => {
                      if (!sec) return "0s";
                      const minutes = Math.floor(sec / 60);
                      const remainingSec = sec % 60;
                      if (minutes > 0) {
                        return remainingSec > 0 ? `${minutes}m ${remainingSec}s` : `${minutes}m`;
                      }
                      return `${sec}s`;
                    };

                    return (
                      <div key={i} className="pt-5 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Lewa kolumna: Nazwa ćwiczenia i partie mięśniowe */}
                        <div className="flex-1 min-w-0 space-y-3">
                          <p className="text-base font-bold text-white tracking-tight">{ex.name}</p>
                          
                          {/* Rozwijana lista (select) partii mięśniowych */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-[#5d6050] whitespace-nowrap">
                              Partia mięśniowa:
                            </label>
                            <div className="relative inline-block w-full sm:w-auto">
                              <select
                                value={ex.muscleGroup || "OTHER"}
                                onChange={(e) => handleMuscleGroupChange(i, e.target.value as MuscleGroup)}
                                className="appearance-none w-full sm:w-auto rounded-lg border border-[#2b2d24] bg-[#0d0e0c] px-3.5 py-1.5 pr-9 text-xs font-semibold text-[#e2e3d8] hover:border-[#bce663]/50 focus:border-[#bce663] focus:outline-none transition-all cursor-pointer"
                              >
                                {Object.entries(muscleGroupLabels).map(([key, label]) => (
                                  <option key={key} value={key} className="bg-[#141511] text-white">
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#8e9182]">
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Prawa kolumna: Serie */}
                        <div className="flex-1 min-w-0 md:max-w-[50%]">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-[#5d6050] mb-2.5">Serie</p>
                          <div className="flex flex-wrap gap-2">
                            {ex.sets?.map((s: any, j: number) => (
                              <span key={j} className="text-xs font-mono bg-[#1a1c18] border border-[#2b2d24] rounded-lg px-2.5 py-1 text-[#e2e3d8]">
                                <span className="text-[#5d6050] font-sans mr-1.5 text-[10px] font-bold">#{s.setNumber}</span>
                                {ex.type === "DURATION" ? (
                                  formatPreviewDuration(s.duration)
                                ) : ex.type === "REPS_ONLY" ? (
                                  `${s.reps ?? 0} powt.`
                                ) : (
                                  `${s.weight ?? 0}kg × ${s.reps ?? 0}`
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              {!uploadPreview ? (
                <button
                  onClick={handleAnalyze}
                  disabled={!uploadFile || uploadLoading}
                  className="flex-1 rounded-xl bg-[#bce663] py-3 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all shadow-lg hover:shadow-[#bce663]/10"
                >
                  {uploadLoading ? "Analizuję przez AI..." : "Analizuj zdjęcie"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setUploadPreview(null); setUploadFile(null); }}
                    className="flex-1 rounded-xl border border-[#2b2d24] py-3 text-xs font-bold text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-all"
                  >
                    Wgraj inne
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={uploadSaving}
                    className="flex-1 rounded-xl bg-[#bce663] py-3 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all shadow-lg hover:shadow-[#bce663]/10"
                  >
                    {uploadSaving ? "Zapisuję..." : "Zapisz trening"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

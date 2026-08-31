import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, AlertCircle } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";
import { pl } from "date-fns/locale";
import { ActivityType } from "@/app/generated/prisma/client";
import { calculateDailyHealthScore, getHealthScoreInterpretation } from "@/lib/services/health-score";

// Komponenty Dashboardu (wymuszenie rekompilacji)
import WeeklyPlan from "@/components/dashboard/weekly-plan";
import DailyTasks from "@/components/dashboard/daily-tasks";
import StatsPanel from "@/components/dashboard/stats-panel";
import { AIQuickAccess } from "@/components/dashboard/ai-quick-access";
import { AgendaTile } from "@/components/dashboard/agenda-tile";
import { getAgenda } from "@/lib/services/health-agenda";

const activityTypeLabel: Record<ActivityType, string> = {
  RUN: "Bieg",
  RIDE: "Rower",
  SWIM: "Pływanie",
  STRENGTH: "Siła",
  OTHER: "Inne",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Agenda „co Cię czeka" — to samo źródło, co panel w /zdrowie (poz. 9 etap 1).
  const agenda = await getAgenda(userId);

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [
    weekActivities,
    lastSync,
    recentActivities,
    todayPlans,
    recentPlanSessions,
    untaggedActivities,
    untaggedStrength,
    latestMeasurement,
    latestRestingHr,
    todayMetric,
    todaySleep,
  ] = await Promise.all([
    // Treningi w tym tygodniu (do statystyk)
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: weekStart, lte: weekEnd } },
    }),
    // Ostatnia synchronizacja
    prisma.syncLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    // 10 ostatnich treningów
    prisma.activity.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    // Dzisiejszy plan treningowy
    prisma.trainingPlanSession.findMany({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
      include: { statuses: true },
    }),
    // Plany treningowe bieżącego tygodnia (do WeeklyPlan)
    prisma.trainingPlanSession.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      include: { statuses: true },
    }),
    // Treningi bez tagu nastroju (endurance)
    prisma.activity.findMany({
      where: {
        userId,
        startedAt: { gte: subDays(today, 7), lte: today },
        moodScore: null,
      },
      orderBy: { startedAt: "desc" },
    }),
    // Treningi siłowe bez tagu nastroju
    prisma.strengthWorkout.findMany({
      where: {
        userId,
        startedAt: { gte: subDays(today, 7), lte: today },
        moodScore: null,
      },
      orderBy: { startedAt: "desc" },
    }),
    // Ostatni pomiar ciała
    prisma.bodyMeasurement.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { weight: true, bodyFat: true, date: true },
    }),
    // Ostatnie tętno spoczynkowe
    prisma.heartRateSample.findFirst({
      where: { userId, type: "resting" },
      orderBy: { recordedAt: "desc" },
      select: { bpm: true, recordedAt: true },
    }),
    // Dzisiejsza metryka dzienna
    prisma.dailyMetric.findFirst({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
    }),
    // Dzisiejszy sen
    prisma.sleepSession.findFirst({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
    }),
  ]);

  const dayLabel = format(today, "EEEE, d MMMM", { locale: pl });
  const untaggedTotal = untaggedActivities.length + untaggedStrength.length;

  const healthBreakdown = calculateDailyHealthScore(todayMetric, todaySleep);

  return (
    <div className="min-h-screen bg-[#0d0e0c] text-white">
      <div className="space-y-6">
        
        {/* Top Header Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2b2d24] pb-5">
          <div>
            <p className="text-[10px] font-mono text-[#5d6050] mb-1">HealthOS / Dashboard</p>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-baseline gap-2">
              <span>Dashboard</span>
              <span className="text-xs font-medium text-[#8e9182] normal-case tracking-normal">
                {dayLabel}
              </span>
            </h1>
            <p className="text-sm text-[#8e9182] mt-1">
              Witaj z powrotem! Masz dziś {todayPlans.length === 0 ? "dzień regeneracji" : `${todayPlans.length} zaplanowane treningi`}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {healthBreakdown.hasData && (
              (() => {
                const interp = getHealthScoreInterpretation(healthBreakdown.score);
                return (
                  <div className={`flex items-center gap-1.5 rounded-xl border ${interp.bgClass} px-3.5 py-2 text-xs font-bold ${interp.colorClass}`}>
                    <Activity className="h-3.5 w-3.5" />
                    <span>Wynik zdrowia: {healthBreakdown.score}/100 ({interp.label})</span>
                  </div>
                );
              })()
            )}
            {lastSync && (
              <div className="flex items-center gap-1.5 rounded-xl border border-[#2b2d24] bg-[#1a1c18] px-3.5 py-2 text-xs text-[#8e9182]">
                <RefreshCw className="h-3.5 w-3.5 animate-spin-slow text-[#bce663]" />
                <span>Ostatnia synch.: {format(new Date(lastSync.createdAt), "HH:mm")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Trzykolumnowy układ Premium */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* KOLUMNA LEWA + ŚRODKOWA (9 kolumn) — Plan + Statystyki + Ostatnie treningi */}
          <div className="lg:col-span-9 space-y-6">
            
            {/* 1. Plan Tygodniowy */}
            <WeeklyPlan initialWorkouts={recentPlanSessions as any} />

            {/* 2. Statystyki tygodnia — pod planem, pełna szerokość lewej kolumny */}
            <StatsPanel
              activities={weekActivities as any}
              lastSync={lastSync as any}
              latestMeasurement={latestMeasurement ? {
                weight: latestMeasurement.weight,
                bodyFat: latestMeasurement.bodyFat,
                date: latestMeasurement.date.toISOString(),
              } : null}
              latestRestingHr={latestRestingHr ? {
                bpm: latestRestingHr.bpm,
                recordedAt: latestRestingHr.recordedAt.toISOString(),
              } : null}
            />

            {/* CTA: Oznacz nastrojem jeśli brak */}
            {untaggedTotal > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Niewykorzystane treningi</h4>
                    <p className="text-[10px] text-[#8e9182] mt-0.5">
                      Masz {untaggedTotal} {untaggedTotal === 1 ? "trening" : "treningi"} z ostatnich 7 dni bez przypisanej oceny samopoczucia.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {untaggedActivities.slice(0, 2).map((a) => (
                    <Link
                      key={a.id}
                      href={`/activities/${a.id}`}
                      className="rounded-lg bg-[#1a1c18] border border-[#2b2d24] px-2.5 py-1.5 text-[9px] font-bold text-[#bce663] hover:border-[#bce663] transition-colors"
                    >
                      Taguj: {a.name.slice(0, 12)}...
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Ostatnie Aktywności — lista */}
            <div className="rounded-2xl border border-[#2b2d24] bg-[#1a1c18] p-5 shadow-lg space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#8e9182] flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#bce663]" /> Ostatnio ukończone treningi
              </h2>

              {recentActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#2b2d24] p-12 text-center text-xs text-[#5d6050]">
                  Brak historii aktywności. Połącz Stravę lub Hevy w Ustawieniach!
                </div>
              ) : (
                <div className="divide-y divide-[#2b2d24]">
                  {recentActivities.slice(0, 8).map((activity) => (
                    <Link
                      key={activity.id}
                      href={`/activities/${activity.id}`}
                      className="flex items-center justify-between py-3 px-2 hover:bg-[#141511]/50 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1b1c16] border border-[#2b2d24] text-[#bce663] text-[10px] font-bold shrink-0">
                          {activity.type.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-[#bce663] transition-colors">
                            {activity.name}
                          </p>
                          <p className="text-[10px] text-[#5d6050] mt-0.5">
                            {format(new Date(activity.startedAt), "d MMM yyyy", { locale: pl })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-right shrink-0">
                        <div className="hidden sm:block">
                          {activity.distance ? (
                            <p className="text-xs font-extrabold text-[#e2e3d8]">
                              {formatDistance(activity.distance)}
                            </p>
                          ) : (
                            <p className="text-xs font-extrabold text-[#e2e3d8]">—</p>
                          )}
                          <p className="text-[10px] text-[#8e9182] mt-0.5">
                            {formatDuration(activity.duration)}
                          </p>
                        </div>
                        {activity.moodScore && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-500/10 text-[#bce663] text-[10px] font-black border border-lime-500/20 shrink-0">
                            {activity.moodScore}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* KOLUMNA PRAWA (3 kolumny) — Zadania na dziś */}
          <div className="lg:col-span-3 space-y-6">
            <AgendaTile agenda={agenda} />
            <DailyTasks />
            <AIQuickAccess />
          </div>

        </div>

      </div>
    </div>
  );
}

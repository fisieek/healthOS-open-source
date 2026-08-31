import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  Dumbbell,
  Trophy,
  Weight,
  TrendingUp,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { StrengthMoodPanel } from "./strength-mood-panel";

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function fmtVolume(kg: number | null): string {
  if (kg == null) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${Math.round(kg)} kg`;
}

interface SetSummary {
  count: number;
  reps: number;
  topWeight: number;
  totalVolume: number;
  prCount: number;
}

function summarizeSets(
  sets: { reps: number | null; weight: number | null; isPr: boolean }[]
): SetSummary {
  let topWeight = 0;
  let reps = 0;
  let totalVolume = 0;
  let prCount = 0;
  for (const s of sets) {
    if (s.weight != null && s.weight > topWeight) topWeight = s.weight;
    if (s.reps != null) reps += s.reps;
    if (s.weight != null && s.reps != null) totalVolume += s.weight * s.reps;
    if (s.isPr) prCount++;
  }
  return { count: sets.length, reps, topWeight, totalVolume, prCount };
}

/** Estimated 1RM (Epley formula). */
function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export default async function StrengthDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const workout = await prisma.strengthWorkout.findUnique({
    where: { id },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      },
      sessionStatuses: {
        include: {
          planSession: { select: { id: true, name: true, type: true, date: true } },
        },
      },
    },
  });

  if (!workout || workout.userId !== session.user.id) notFound();

  // Lookup previous occurrence of each exercise (by name) to compute deltas
  const prevByName = new Map<string, { topWeight: number; totalVolume: number }>();
  for (const ex of workout.exercises) {
    const prev = await prisma.strengthExercise.findFirst({
      where: {
        name: ex.name,
        workout: { userId: workout.userId, startedAt: { lt: workout.startedAt } },
      },
      orderBy: { workout: { startedAt: "desc" } },
      include: { sets: true },
    });
    if (prev) {
      const sum = summarizeSets(prev.sets);
      prevByName.set(ex.name, { topWeight: sum.topWeight, totalVolume: sum.totalVolume });
    }
  }

  // Workout-level totals
  let totalSets = 0;
  let totalReps = 0;
  let totalPrs = 0;
  for (const ex of workout.exercises) {
    const s = summarizeSets(ex.sets);
    totalSets += s.count;
    totalReps += s.reps;
    totalPrs += s.prCount;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 min-w-0">
        <Link
          href="/strength"
          className="text-muted-foreground hover:text-foreground transition-colors mt-1"
          aria-label="Wróć do listy"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              <Dumbbell className="h-3 w-3 mr-1" /> Siła
            </Badge>
            {totalPrs > 0 && (
              <Badge className="text-[10px] bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                <Trophy className="h-3 w-3 mr-1" />
                {totalPrs} PR
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-1">{workout.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(workout.startedAt, "EEEE, d MMMM yyyy 'o' HH:mm", { locale: pl })}
          </p>
        </div>
      </div>

      {/* Plan link */}
      {workout.sessionStatuses[0]?.planSession && (
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            📋 Plan: {workout.sessionStatuses[0].planSession.name}
          </Badge>
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium">{workout.sessionStatuses[0].status}</span>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        <KpiCard icon={Clock} label="Czas" value={fmtDuration(workout.duration)} />
        <KpiCard icon={Weight} label="Tonaż" value={fmtVolume(workout.volume)} />
        <KpiCard icon={Dumbbell} label="Ćwiczeń" value={String(workout.exercises.length)} />
        <KpiCard icon={Hash} label="Serii" value={String(totalSets)} hint={`${totalReps} powt.`} />
        <KpiCard icon={Trophy} label="PR-y" value={String(totalPrs)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Exercises */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
            Ćwiczenia
          </h2>
          {workout.exercises.map((ex) => {
            const sum = summarizeSets(ex.sets);
            const prev = prevByName.get(ex.name);

            // Estimated 1RM from best set this session
            const best = ex.sets.reduce<{ w: number; r: number } | null>((acc, s) => {
              if (s.weight == null || s.reps == null || s.reps <= 0) return acc;
              const e1 = estimate1RM(s.weight, s.reps);
              const cur = acc ? estimate1RM(acc.w, acc.r) : 0;
              return e1 > cur ? { w: s.weight, r: s.reps } : acc;
            }, null);
            const e1rm = best ? estimate1RM(best.w, best.r) : null;

            const dWeight = prev ? sum.topWeight - prev.topWeight : null;
            const dVolume = prev ? sum.totalVolume - prev.totalVolume : null;

            return (
              <div
                key={ex.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {sum.prCount > 0 && (
                      <Trophy className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{ex.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>
                      {sum.count} × {sum.reps} powt.
                    </span>
                    <span className="font-medium text-foreground">
                      max {sum.topWeight} kg
                    </span>
                    {e1rm != null && (
                      <span className="hidden sm:inline">e1RM ≈ {e1rm.toFixed(1)} kg</span>
                    )}
                  </div>
                </div>

                {/* Delta vs prev session */}
                {prev && (dWeight !== 0 || dVolume !== 0) && (
                  <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/30 border-b border-border flex items-center gap-3">
                    <TrendingUp className="h-3 w-3" />
                    <span>
                      vs ostatnio: max{" "}
                      <span
                        className={
                          dWeight! > 0
                            ? "text-green-600"
                            : dWeight! < 0
                            ? "text-red-500"
                            : ""
                        }
                      >
                        {dWeight! > 0 ? "+" : ""}
                        {dWeight!.toFixed(1)} kg
                      </span>
                      , obj.{" "}
                      <span
                        className={
                          dVolume! > 0
                            ? "text-green-600"
                            : dVolume! < 0
                            ? "text-red-500"
                            : ""
                        }
                      >
                        {dVolume! > 0 ? "+" : ""}
                        {Math.round(dVolume!)} kg
                      </span>
                    </span>
                  </div>
                )}

                {/* Sets */}
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/20">
                    <span className="col-span-1">#</span>
                    <span className="col-span-3">Ciężar</span>
                    <span className="col-span-3">Powt.</span>
                    <span className="col-span-3">RPE</span>
                    <span className="col-span-2 text-right">PR</span>
                  </div>
                  {ex.sets.map((s) => (
                    <div
                      key={s.id}
                      className={`grid grid-cols-12 gap-2 px-3 py-1.5 text-xs ${
                        s.isPr ? "bg-yellow-500/5" : ""
                      }`}
                    >
                      <span className="col-span-1 text-muted-foreground">{s.setNumber}</span>
                      <span className="col-span-3 font-mono">
                        {s.weight != null ? `${s.weight} kg` : "—"}
                      </span>
                      <span className="col-span-3 font-mono">{s.reps ?? (s.duration ? `${s.duration}s` : "—")}</span>
                      <span className="col-span-3 font-mono text-muted-foreground">
                        {s.rpe != null ? s.rpe : "—"}
                      </span>
                      <span className="col-span-2 text-right">
                        {s.isPr ? <Trophy className="h-3.5 w-3.5 text-yellow-500 inline" /> : ""}
                      </span>
                    </div>
                  ))}
                </div>

                {ex.notes && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border whitespace-pre-wrap">
                    {ex.notes}
                  </div>
                )}
              </div>
            );
          })}

          {workout.notes && (
            <div className="rounded-lg border border-border bg-card p-3">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide mb-1.5">
                Notatka treningu
              </h3>
              <p className="text-sm whitespace-pre-wrap">{workout.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <StrengthMoodPanel
              workoutId={workout.id}
              initialMood={workout.moodScore}
              initialNote={workout.moodNote}
            />
          </div>
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Źródło</span>
              <span>Hevy</span>
            </div>
            {workout.sourceId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source ID</span>
                <span className="font-mono text-[10px]">{workout.sourceId}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

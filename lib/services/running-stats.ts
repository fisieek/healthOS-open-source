import { prisma } from "@/lib/db";
import { ActivityType, Prisma } from "@/app/generated/prisma";
import { startOfWeek, subWeeks, subDays, startOfDay } from "date-fns";

export interface Vo2maxPoint {
  date: string;
  vdot: number;
}

export interface PaceRecord {
  distanceLabel: string;
  timeSec: number;
  paceMinKm: string;
  formattedTime: string;
  date: string;
  activityId: string;
  activityName: string;
}

export interface RunningVolumeStats {
  longestRunKm: number;
  thisWeekRunKm: number;
  maxWeeklyRunKm: number;
  consistencyScore: number; // 0-100%
}

export interface HrZonesSummary {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  total: number;
}

/**
 * Format seconds to hh:mm:ss or mm:ss
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

/**
 * Format pace to mm:ss /km
 */
function formatPace(secondsPerKm: number): string {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return "--:--";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

/**
 * Get VDOT / VO2max trend for the last N weeks
 */
export async function getVo2maxTrend(userId: string, limitWeeks = 12): Promise<Vo2maxPoint[]> {
  const dateLimit = subWeeks(new Date(), limitWeeks);

  const runs = await prisma.activity.findMany({
    where: {
      userId,
      type: ActivityType.RUN,
      vdotEstimate: { not: null },
      startedAt: { gte: dateLimit },
    },
    select: {
      startedAt: true,
      vdotEstimate: true,
    },
    orderBy: {
      startedAt: "asc",
    },
  });

  return runs.map((run) => ({
    date: run.startedAt.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }),
    vdot: run.vdotEstimate ?? 0,
  }));
}

/**
 * Extract personal bests from Strava rawData (best_efforts)
 */
export async function getPaceRecords(userId: string): Promise<Record<string, PaceRecord | null>> {
  const runs = await prisma.activity.findMany({
    where: {
      userId,
      type: ActivityType.RUN,
    },
    select: {
      id: true,
      name: true,
      startedAt: true,
      distance: true,
      duration: true,
      rawData: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  const records: Record<string, PaceRecord | null> = {
    "1k": null,
    "5k": null,
    "10k": null,
    "Half": null,
  };

  // Target distances in meters (approximate bounds to find best efforts)
  const targets = [
    { key: "1k", name: "1k", dist: 1000 },
    { key: "5k", name: "5k", dist: 5000 },
    { key: "10k", name: "10k", dist: 10000 },
    { key: "Half", name: "Half-Marathon", dist: 21097 },
  ];

  // 1. Try extracting personal bests from Strava rawData (best_efforts)
  for (const run of runs) {
    if (run.rawData && typeof run.rawData === "object") {
      const raw = run.rawData as any;
      const bestEfforts = raw.best_efforts;

      if (Array.isArray(bestEfforts)) {
        for (const effort of bestEfforts) {
          if (!effort || typeof effort !== "object") continue;

          const effortDistance = effort.distance;
          const effortTime = effort.elapsed_time || effort.moving_time;

          if (!effortDistance || !effortTime) continue;

          for (const target of targets) {
            // Match the effort to target distance (allowing very small margin of ±50m or by exact name match)
            const isMatch =
              Math.abs(effortDistance - target.dist) < 50 ||
              (effort.name && String(effort.name).toLowerCase().includes(target.key.toLowerCase())) ||
              (effort.name && String(effort.name).toLowerCase().replace("-", "").includes(target.name.toLowerCase()));

            if (isMatch) {
              const currentBest = records[target.key];
              if (!currentBest || effortTime < currentBest.timeSec) {
                const pace = effortTime / (effortDistance / 1000);
                records[target.key] = {
                  distanceLabel: target.key === "Half" ? "Półmaraton" : target.key,
                  timeSec: effortTime,
                  paceMinKm: formatPace(pace),
                  formattedTime: formatTime(effortTime),
                  date: run.startedAt.toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }),
                  activityId: run.id,
                  activityName: run.name,
                };
              }
            }
          }
        }
      }
    }
  }

  // 2. Fallback: If some records are still empty, calculate them based on the average pace of suitable runs
  for (const target of targets) {
    if (records[target.key] === null) {
      for (const run of runs) {
        if (!run.distance || !run.duration) continue;

        // Bieg musi mieć dystans co najmniej równy targetowi
        if (run.distance >= target.dist) {
          const avgPace = run.duration / run.distance; // s / m
          const estimatedTimeSec = Math.round(avgPace * target.dist);

          const currentBest = records[target.key];
          if (!currentBest || estimatedTimeSec < currentBest.timeSec) {
            records[target.key] = {
              distanceLabel: target.key === "Half" ? "Półmaraton" : target.key,
              timeSec: estimatedTimeSec,
              paceMinKm: formatPace(avgPace * 1000),
              formattedTime: formatTime(estimatedTimeSec),
              date: run.startedAt.toLocaleDateString("pl-PL", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }),
              activityId: run.id,
              activityName: run.name,
            };
          }
        }
      }
    }
  }

  return records;
}

/**
 * Get running volume, weekly distance and consistency over 12 weeks
 */
export async function getVolumeStats(userId: string): Promise<RunningVolumeStats> {
  const now = new Date();
  const dateLimit12W = subWeeks(now, 12);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  // 1. Fetch runs
  const runs = await prisma.activity.findMany({
    where: {
      userId,
      type: ActivityType.RUN,
    },
    select: {
      distance: true,
      startedAt: true,
    },
  });

  const longestRunM = runs.reduce((max, r) => Math.max(max, r.distance ?? 0), 0);

  // 2. This week distance
  const thisWeekRunM = runs
    .filter((r) => r.startedAt >= weekStart)
    .reduce((sum, r) => sum + (r.distance ?? 0), 0);

  // 3. Weekly distances for the last 12 weeks (to find the max weekly mileage)
  const weeklyDistances: number[] = Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);

    weeklyDistances[i] = runs
      .filter((r) => r.startedAt >= ws && r.startedAt < we)
      .reduce((sum, r) => sum + (r.distance ?? 0), 0);
  }
  const maxWeeklyRunM = Math.max(...weeklyDistances, 0);

  // 4. Consistency Score (based on running plans in the last 12 weeks)
  const plannedSessions = await prisma.trainingPlanSession.findMany({
    where: {
      userId,
      date: { gte: dateLimit12W, lte: now },
    },
    include: {
      statuses: true,
    },
  });

  const filteredSessions = plannedSessions.filter((s) => {
    const nameLower = (s.name ?? "").toLowerCase();
    const notesLower = (s.notes ?? "").toLowerCase();
    return (
      nameLower.includes("bieg") ||
      nameLower.includes("run") ||
      notesLower.includes("bieg") ||
      notesLower.includes("run")
    );
  });

  let consistencyScore = 100;
  if (filteredSessions.length > 0) {
    const completed = filteredSessions.filter((s: any) =>
      s.statuses && s.statuses.some((st: any) => st.status === "DONE")
    ).length;
    consistencyScore = Math.round((completed / filteredSessions.length) * 100);
  }

  return {
    longestRunKm: Math.round((longestRunM / 1000) * 10) / 10,
    thisWeekRunKm: Math.round((thisWeekRunM / 1000) * 10) / 10,
    maxWeeklyRunKm: Math.round((maxWeeklyRunM / 1000) * 10) / 10,
    consistencyScore,
  };
}

/**
 * Get aggregated HR zones summary for the last N days
 */
export async function getHrZonesSummary(userId: string, days = 7): Promise<HrZonesSummary> {
  const dateLimit = subDays(startOfDay(new Date()), days);

  const runs = await prisma.activity.findMany({
    where: {
      userId,
      type: ActivityType.RUN,
      startedAt: { gte: dateLimit },
      zoneMinutes: { not: Prisma.DbNull },
    },
    select: {
      zoneMinutes: true,
    },
  });

  const summary: HrZonesSummary = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, total: 0 };

  for (const run of runs) {
    if (!run.zoneMinutes || typeof run.zoneMinutes !== "object") continue;
    const zm = run.zoneMinutes as any;
    summary.z1 += zm.z1 ?? 0;
    summary.z2 += zm.z2 ?? 0;
    summary.z3 += zm.z3 ?? 0;
    summary.z4 += zm.z4 ?? 0;
    summary.z5 += zm.z5 ?? 0;
    summary.total += zm.total ?? 0;
  }

  return summary;
}

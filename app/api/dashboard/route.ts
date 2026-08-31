import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const yesterday = subDays(today, 1);

  const [
    todayActivities,
    lastSleep,
    latestMetric,
    latestWeight,
    latestWellness,
    weekActivities,
    lastSyncLog,
  ] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { startedAt: "asc" },
      select: { id: true, name: true, type: true, duration: true, distance: true, startedAt: true },
    }),
    prisma.sleepSession.findFirst({
      where: {
        userId,
        date: { gte: subDays(today, 2), lte: today },
      },
      orderBy: { date: "desc" },
    }),
    prisma.dailyMetric.findFirst({
      where: { userId, date: { gte: subDays(today, 3), lte: today } },
      orderBy: { date: "desc" },
    }),
    prisma.bodyMeasurement.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { weight: true, date: true },
    }),
    prisma.wellnessEntry.findFirst({
      where: { userId, date: { gte: subDays(today, 3), lte: today } },
      orderBy: { date: "desc" },
    }),
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: weekStart, lte: weekEnd } },
      select: { type: true, duration: true, distance: true },
    }),
    prisma.syncLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true, triggeredBy: true },
    }),
  ]);

  const weekDistance = weekActivities.reduce((s, a) => s + (a.distance ?? 0), 0);
  const weekDuration = weekActivities.reduce((s, a) => s + a.duration, 0);

  return NextResponse.json({
    today: {
      activities: todayActivities,
      totalDuration: todayActivities.reduce((s, a) => s + a.duration, 0),
      totalDistance: todayActivities.reduce((s, a) => s + (a.distance ?? 0), 0),
    },
    sleep: lastSleep
      ? {
          totalMinutes: lastSleep.totalMinutes,
          efficiency: lastSleep.efficiency,
          date: lastSleep.date,
        }
      : null,
    metrics: latestMetric
      ? {
          restingHr: latestMetric.restingHr,
          hrv: latestMetric.hrv,
          steps: latestMetric.steps,
          date: latestMetric.date,
        }
      : null,
    weight: latestWeight ?? null,
    wellness: latestWellness
      ? { energyScore: latestWellness.energyScore, moodScore: latestWellness.moodScore }
      : null,
    week: {
      distanceM: weekDistance,
      durationSec: weekDuration,
      activityCount: weekActivities.length,
    },
    lastSync: lastSyncLog ?? null,
  });
}

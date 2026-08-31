import { prisma } from "@/lib/db";
import {
  ActivityType,
  IntensityClass,
  Prisma,
} from "@/app/generated/prisma";
import {
  computeZones,
  computeTimeInZones,
  zoneSecondsToMinutes,
  type ZoneDef,
} from "@/lib/services/zones";

/**
 * Daniels VDOT calculation.
 * Formula: VDOT = VO2 / %VO2max
 *   VO2 = -4.6 + 0.182258·v + 0.000104·v²    (v = m/min)
 *   %VO2max = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)   (t = minutes)
 *
 * Apply only to runs that are race-effort or sustained tempo:
 *   - distance ≥ 1.5 km
 *   - duration ≥ 6 min (5K race floor) and ≤ 240 min
 *   - intensity TEMPO / THRESHOLD / RACE only
 */
export function calculateVdot(distanceMeters: number, durationSec: number): number | null {
  if (distanceMeters < 1500 || durationSec < 360 || durationSec > 14400) return null;
  const tMin = durationSec / 60;
  const v = distanceMeters / tMin; // m/min
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const pct =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * tMin) +
    0.2989558 * Math.exp(-0.1932605 * tMin);
  if (pct <= 0) return null;
  const vdot = vo2 / pct;
  if (!Number.isFinite(vdot) || vdot < 20 || vdot > 90) return null;
  return Math.round(vdot * 10) / 10;
}

interface ZoneMinutes {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  total: number;
}

interface ClassifyContext {
  type: ActivityType;
  duration: number;
  distance: number | null;
  zoneMinutes: ZoneMinutes | null;
  avgHr: number | null;
  maxHr: number | null;
  /** Recent training context for "long" detection */
  weekDistanceMeters: number;
  /** Was this the longest run/ride this week? */
  isLongest: boolean;
}

/**
 * Classify an activity's intensity from data.
 *
 * Rules (running/cycling, with HR data):
 *   - >40% time in Z4+Z5 → INTERVAL (lots of high-intensity work)
 *   - >25% time in Z4+Z5 with avg HR ≥ Z4 low → THRESHOLD
 *   - >20% time in Z3 with avg HR in Z3 → TEMPO
 *   - distance > 80% of week distance OR duration > 90 min mostly Z2 → LONG
 *   - >70% time in Z1 → RECOVERY
 *   - mostly Z2 → EASY
 *   - mostly Z3 → STEADY
 *
 * Without HR streams, fall back to avgHr % maxHr + duration heuristics.
 */
export function classifyIntensity(ctx: ClassifyContext): IntensityClass {
  if (ctx.type === ActivityType.STRENGTH) return IntensityClass.OTHER;
  if (ctx.type === ActivityType.OTHER) return IntensityClass.OTHER;

  const zm = ctx.zoneMinutes;

  // RACE auto-detection: not implemented (would need user to mark or detect from name).
  // We let users override post-hoc if it was a race.

  if (zm && zm.total > 0) {
    const z45 = (zm.z4 + zm.z5) / zm.total;
    const z3 = zm.z3 / zm.total;
    const z2 = zm.z2 / zm.total;
    const z1 = zm.z1 / zm.total;

    if (z45 >= 0.4) return IntensityClass.INTERVAL;
    if (z45 >= 0.2) return IntensityClass.THRESHOLD;
    if (z3 >= 0.4) return IntensityClass.TEMPO;
    if (ctx.isLongest && (ctx.duration >= 90 * 60 || (ctx.distance ?? 0) >= 15000))
      return IntensityClass.LONG;
    if (z1 >= 0.7) return IntensityClass.RECOVERY;
    if (z2 >= 0.5) return IntensityClass.EASY;
    return IntensityClass.STEADY;
  }

  // No streams → use avgHr / maxHr heuristic.
  if (ctx.avgHr && ctx.maxHr) {
    const ratio = ctx.avgHr / ctx.maxHr;
    if (ratio >= 0.92) return IntensityClass.INTERVAL;
    if (ratio >= 0.85) return IntensityClass.THRESHOLD;
    if (ratio >= 0.78) return IntensityClass.TEMPO;
    if (ctx.isLongest && ctx.duration >= 90 * 60) return IntensityClass.LONG;
    if (ratio >= 0.65) return IntensityClass.EASY;
    if (ratio >= 0.5) return IntensityClass.RECOVERY;
  }

  // Last resort: by duration only
  if (ctx.duration >= 90 * 60) return IntensityClass.LONG;
  if (ctx.duration < 30 * 60) return IntensityClass.RECOVERY;
  return IntensityClass.EASY;
}

/**
 * Recompute analytics (zoneMinutes, intensityClass, vdotEstimate) for one activity.
 * Honors `intensityClassOverride` (won't change manually-pinned class).
 */
export async function recomputeActivityAnalytics(activityId: string): Promise<void> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      userId: true,
      type: true,
      duration: true,
      distance: true,
      avgHr: true,
      maxHr: true,
      streams: true,
      intensityClass: true,
      intensityClassOverride: true,
      startedAt: true,
    },
  });
  if (!a) return;

  // Only RUN/RIDE/SWIM produce zone minutes (STRENGTH has no HR streams typically).
  const profile = await prisma.userProfile.findUnique({
    where: { userId: a.userId },
    select: { maxHr: true, restingHr: true, lthr: true, zonesMethod: true },
  });

  let zones: ZoneDef[] | null = null;
  if (profile) {
    zones = computeZones({
      method: profile.zonesMethod,
      maxHr: profile.maxHr,
      restingHr: profile.restingHr,
      lthr: profile.lthr,
    });
  }

  let zoneMinutes: ZoneMinutes | null = null;
  if (zones && a.streams && typeof a.streams === "object") {
    const streams = a.streams as Record<string, { data?: number[] } | undefined>;
    const hrData = streams.heartrate?.data;
    const timeData = streams.time?.data;
    if (Array.isArray(hrData) && hrData.length > 0) {
      const seconds = computeTimeInZones(
        hrData as number[],
        Array.isArray(timeData) ? (timeData as number[]) : undefined,
        zones
      );
      if (seconds) zoneMinutes = zoneSecondsToMinutes(seconds);
    }
  }

  // For longest detection, get this week's longest activity of same type.
  const weekStart = new Date(a.startedAt);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sameWeek = await prisma.activity.findMany({
    where: {
      userId: a.userId,
      type: a.type,
      startedAt: { gte: weekStart, lt: weekEnd },
    },
    select: { id: true, duration: true, distance: true },
  });
  const longestId = sameWeek.reduce<{ id: string; score: number } | null>((acc, w) => {
    const score = (w.distance ?? 0) + w.duration; // simple combined score
    if (!acc || score > acc.score) return { id: w.id, score };
    return acc;
  }, null);
  const isLongest = longestId?.id === a.id;
  const weekDistanceMeters = sameWeek.reduce((s, w) => s + (w.distance ?? 0), 0);

  // Classify (skip if user pinned)
  let intensityClass = a.intensityClass;
  if (!a.intensityClassOverride) {
    intensityClass = classifyIntensity({
      type: a.type,
      duration: a.duration,
      distance: a.distance,
      zoneMinutes,
      avgHr: a.avgHr,
      maxHr: a.maxHr ?? profile?.maxHr ?? null,
      weekDistanceMeters,
      isLongest,
    });
  }

  // VDOT only for qualifying RUN
  let vdotEstimate: number | null = null;
  if (
    a.type === ActivityType.RUN &&
    a.distance &&
    (intensityClass === IntensityClass.TEMPO ||
      intensityClass === IntensityClass.THRESHOLD ||
      intensityClass === IntensityClass.RACE)
  ) {
    vdotEstimate = calculateVdot(a.distance, a.duration);
  }

  const updateData: Prisma.ActivityUpdateInput = {};
  if (zoneMinutes) {
    updateData.zoneMinutes = zoneMinutes as unknown as Prisma.InputJsonValue;
  }
  if (intensityClass !== a.intensityClass) {
    updateData.intensityClass = intensityClass;
  }
  if (vdotEstimate !== null) {
    updateData.vdotEstimate = vdotEstimate;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.activity.update({ where: { id: a.id }, data: updateData });
  }
}

/**
 * Recompute analytics for many activities (e.g. after profile change or backfill).
 */
export async function recomputeUserActivities(
  userId: string,
  options: { from?: Date } = {}
): Promise<{ processed: number }> {
  const where: Prisma.ActivityWhereInput = { userId };
  if (options.from) where.startedAt = { gte: options.from };

  const ids = await prisma.activity.findMany({
    where,
    select: { id: true },
    orderBy: { startedAt: "desc" },
  });

  for (const { id } of ids) {
    await recomputeActivityAnalytics(id);
  }
  return { processed: ids.length };
}

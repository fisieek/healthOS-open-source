import { prisma } from "@/lib/db";
import {
  ActivityType,
  SessionStatus,
} from "@/app/generated/prisma/client";
import { startOfDay, addDays, endOfDay } from "date-fns";

/**
 * Plan ↔ Activity matcher.
 *
 * Strategy:
 *  - For each plan session within window (default: last 60 days) without overridden status,
 *    find best candidate activity/strength workout:
 *    - Same day preferred, ±1 day allowed
 *    - Same ActivityType (RUN matches RUN, etc.)
 *    - Score = ratio of achieved/target parameter (distance/duration/volume)
 *  - Compute status from achievement ratio:
 *    - >= 70% of target → DONE
 *    - 30-70%          → PARTIALLY_DONE
 *    - < 30% or none   → MISSED (only if plan date is in past)
 *  - Future/today plan sessions stay PLANNED until a matching activity appears.
 */

interface ActivityCandidate {
  id: string;
  startedAt: Date;
  type: ActivityType;
  duration: number;
  distance: number | null;
  isStrength: false;
}

interface StrengthCandidate {
  id: string;
  startedAt: Date;
  duration: number | null;
  volume: number | null;
  isStrength: true;
}

type Candidate = ActivityCandidate | StrengthCandidate;

interface MatchResult {
  status: SessionStatus;
  activityId: string | null;
  strengthId: string | null;
  matchScore: number | null;
}

interface ScoredCandidate {
  candidate: Candidate;
  achievementRatio: number; // 0-2 (or higher for over-achievement)
  dateProximity: number; // 0 (same day) — 2 (±2 days)
}

const MATCH_WINDOW_DAYS = 1;

function getDayDistance(d1: Date, d2: Date): number {
  const day1 = startOfDay(d1).getTime();
  const day2 = startOfDay(d2).getTime();
  return Math.abs(Math.round((day1 - day2) / (1000 * 60 * 60 * 24)));
}

/**
 * Computes how well a candidate fulfills the plan's targets.
 * Returns a ratio (1.0 = perfect match, >1 = over-achieved, <1 = under).
 * If no targets are set, returns 1.0 if type matches.
 */
function computeAchievement(
  plan: {
    targetDistance: number | null;
    targetDuration: number | null;
    targetVolume: number | null;
  },
  candidate: Candidate
): number {
  const ratios: number[] = [];

  if (candidate.isStrength) {
    if (plan.targetVolume && plan.targetVolume > 0 && candidate.volume) {
      ratios.push(candidate.volume / plan.targetVolume);
    }
    if (plan.targetDuration && plan.targetDuration > 0 && candidate.duration) {
      ratios.push(candidate.duration / plan.targetDuration);
    }
  } else {
    if (plan.targetDistance && plan.targetDistance > 0 && candidate.distance) {
      ratios.push(candidate.distance / plan.targetDistance);
    }
    if (plan.targetDuration && plan.targetDuration > 0) {
      ratios.push(candidate.duration / plan.targetDuration);
    }
  }

  if (ratios.length === 0) return 1.0; // no targets → just type match
  // Use minimum: if either distance or duration falls short, achievement is bounded by it
  return Math.min(...ratios);
}

function statusFromRatio(ratio: number, isPast: boolean): SessionStatus {
  if (ratio >= 0.7) return SessionStatus.DONE;
  if (ratio >= 0.3) return SessionStatus.PARTIALLY_DONE;
  return isPast ? SessionStatus.MISSED : SessionStatus.PLANNED;
}

/**
 * Finds the best candidate for a single plan session.
 */
async function findMatch(
  userId: string,
  plan: {
    id: string;
    date: Date;
    type: ActivityType;
    targetDistance: number | null;
    targetDuration: number | null;
    targetVolume: number | null;
  }
): Promise<MatchResult> {
  const windowStart = startOfDay(addDays(plan.date, -MATCH_WINDOW_DAYS));
  const windowEnd = endOfDay(addDays(plan.date, MATCH_WINDOW_DAYS));
  const isPast = plan.date < startOfDay(new Date());

  let candidates: Candidate[] = [];

  if (plan.type === ActivityType.STRENGTH) {
    const workouts = await prisma.strengthWorkout.findMany({
      where: { userId, startedAt: { gte: windowStart, lte: windowEnd } },
      select: { id: true, startedAt: true, duration: true, volume: true },
    });
    candidates = workouts.map((w) => ({ ...w, isStrength: true as const }));
  } else {
    const acts = await prisma.activity.findMany({
      where: {
        userId,
        startedAt: { gte: windowStart, lte: windowEnd },
        type: plan.type,
      },
      select: {
        id: true,
        startedAt: true,
        type: true,
        duration: true,
        distance: true,
      },
    });
    candidates = acts.map((a) => ({ ...a, isStrength: false as const }));
  }

  if (candidates.length === 0) {
    return {
      status: isPast ? SessionStatus.MISSED : SessionStatus.PLANNED,
      activityId: null,
      strengthId: null,
      matchScore: null,
    };
  }

  // Score and pick best: prefer closer to plan date, then highest achievement
  const scored: ScoredCandidate[] = candidates.map((c) => ({
    candidate: c,
    achievementRatio: computeAchievement(plan, c),
    dateProximity: getDayDistance(c.startedAt, plan.date),
  }));

  scored.sort((a, b) => {
    // 1) prefer closer date
    if (a.dateProximity !== b.dateProximity) return a.dateProximity - b.dateProximity;
    // 2) prefer ratio closer to 1 (so over-achievement doesn't beat a perfect match)
    const aDist = Math.abs(a.achievementRatio - 1);
    const bDist = Math.abs(b.achievementRatio - 1);
    return aDist - bDist;
  });

  const best = scored[0];
  const status = statusFromRatio(best.achievementRatio, isPast);

  return {
    status,
    activityId: best.candidate.isStrength ? null : best.candidate.id,
    strengthId: best.candidate.isStrength ? best.candidate.id : null,
    matchScore: best.achievementRatio,
  };
}

/**
 * Runs auto-matching for a user's plan sessions.
 * Skips sessions whose status was manually overridden (overriddenAt != null).
 *
 * @returns count of plan sessions processed and updated
 */
export async function matchPlanSessions(
  userId: string,
  options?: { from?: Date; to?: Date }
): Promise<{ processed: number; updated: number }> {
  const from = options?.from ?? addDays(new Date(), -60);
  const to = options?.to ?? addDays(new Date(), 30);

  const sessions = await prisma.trainingPlanSession.findMany({
    where: { userId, date: { gte: from, lte: to } },
    select: {
      id: true,
      date: true,
      type: true,
      targetDistance: true,
      targetDuration: true,
      targetVolume: true,
      statuses: true,
    },
  });

  let updated = 0;
  for (const s of sessions) {
    const existing = s.statuses[0]; // unique on planSessionId
    if (existing?.overriddenAt) continue; // respect manual override

    const match = await findMatch(userId, s);

    // Skip if nothing changed (avoid noisy updates)
    if (
      existing &&
      existing.status === match.status &&
      existing.activityId === match.activityId &&
      existing.strengthId === match.strengthId
    ) {
      continue;
    }

    await prisma.trainingSessionStatus.upsert({
      where: { planSessionId: s.id },
      create: {
        planSessionId: s.id,
        status: match.status,
        activityId: match.activityId,
        strengthId: match.strengthId,
        matchScore: match.matchScore,
      },
      update: {
        status: match.status,
        activityId: match.activityId,
        strengthId: match.strengthId,
        matchScore: match.matchScore,
      },
    });
    updated++;
  }

  return { processed: sessions.length, updated };
}

/**
 * Manually override a plan session's status / matched activity.
 */
export async function overridePlanStatus(
  userId: string,
  planSessionId: string,
  payload: {
    status: SessionStatus;
    activityId?: string | null;
    strengthId?: string | null;
  }
): Promise<void> {
  // Verify ownership
  const plan = await prisma.trainingPlanSession.findUnique({
    where: { id: planSessionId },
    select: { userId: true },
  });
  if (!plan || plan.userId !== userId) throw new Error("Not found");

  await prisma.trainingSessionStatus.upsert({
    where: { planSessionId },
    create: {
      planSessionId,
      status: payload.status,
      activityId: payload.activityId ?? null,
      strengthId: payload.strengthId ?? null,
      matchScore: null,
      overriddenAt: new Date(),
    },
    update: {
      status: payload.status,
      activityId: payload.activityId ?? null,
      strengthId: payload.strengthId ?? null,
      overriddenAt: new Date(),
    },
  });
}

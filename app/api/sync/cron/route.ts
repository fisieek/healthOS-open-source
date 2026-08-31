import { prisma } from "@/lib/db";
import { syncStravaActivities } from "@/lib/services/strava";
import { syncHevyWorkouts } from "@/lib/services/hevy";
import { syncRunnaCalendar } from "@/lib/services/runna";
import { matchPlanSessions } from "@/lib/services/plan-matcher";
import { DataSourceType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — enough for multi-user, multi-source sync

/**
 * GET/POST /api/sync/cron
 *
 * Daily automated sync — triggered by Vercel Cron (vercel.json schedule "0 3 * * *").
 * Auth: Bearer CRON_SECRET (Vercel auto-adds this header for cron jobs).
 *
 * For each user with active Strava/Hevy data sources:
 *  1. Sync Strava activities (if connected)
 *  2. Sync Hevy workouts (if connected)
 *  3. Run plan matcher to update training session statuses
 *
 * Resilient: one user/source failure doesn't block others.
 *
 * Returns: { ok, processed, results: [{ userId, strava, hevy, matched, errors }] }
 */

interface UserSyncResult {
  userId: string;
  strava: { synced: number } | { error: string } | null;
  hevy: { synced: number } | { error: string } | null;
  runna: { synced: number } | { error: string } | null;
  matched: { processed: number; updated: number } | { error: string } | null;
}

async function handleRequest(request: Request) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  // Find all users with at least one active data source we can auto-sync
  const usersToSync = await prisma.user.findMany({
    select: {
      id: true,
      dataSources: {
        where: { isActive: true },
        select: { type: true, id: true },
      },
    },
  });

  const results: UserSyncResult[] = [];

  for (const user of usersToSync) {
    const userResult: UserSyncResult = {
      userId: user.id,
      strava: null,
      hevy: null,
      runna: null,
      matched: null,
    };

    const stravaSource = user.dataSources.find((s) => s.type === DataSourceType.STRAVA);
    const hevySource = user.dataSources.find((s) => s.type === DataSourceType.HEVY);

    // ─── Strava ─────────────────────────────────────────────────────────────
    if (stravaSource) {
      const sourceStarted = new Date();
      try {
        const synced = await syncStravaActivities(user.id);
        userResult.strava = { synced };
        await prisma.syncLog.create({
          data: {
            userId: user.id,
            dataSourceId: stravaSource.id,
            triggeredBy: "cron",
            status: "success",
            itemsSynced: synced,
            startedAt: sourceStarted,
            finishedAt: new Date(),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown Strava error";
        userResult.strava = { error: message };
        await prisma.syncLog.create({
          data: {
            userId: user.id,
            dataSourceId: stravaSource.id,
            triggeredBy: "cron",
            status: "error",
            error: message,
            startedAt: sourceStarted,
            finishedAt: new Date(),
          },
        });
      }
    }

    // ─── Hevy ───────────────────────────────────────────────────────────────
    if (hevySource) {
      const sourceStarted = new Date();
      try {
        const { synced } = await syncHevyWorkouts(user.id);
        userResult.hevy = { synced };
        await prisma.syncLog.create({
          data: {
            userId: user.id,
            dataSourceId: hevySource.id,
            triggeredBy: "cron",
            status: "success",
            itemsSynced: synced,
            startedAt: sourceStarted,
            finishedAt: new Date(),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown Hevy error";
        userResult.hevy = { error: message };
        await prisma.syncLog.create({
          data: {
            userId: user.id,
            dataSourceId: hevySource.id,
            triggeredBy: "cron",
            status: "error",
            error: message,
            startedAt: sourceStarted,
            finishedAt: new Date(),
          },
        });
      }
    }

    // ─── Runna ──────────────────────────────────────────────────────────────
    let runnaSynced = false;
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: user.id },
        select: { settings: true },
      });
      const settings = (profile?.settings ?? {}) as Record<string, any>;
      const runnaCalendarUrl = settings.runnaCalendarUrl;

      if (runnaCalendarUrl) {
        const sourceStarted = new Date();
        try {
          const syncRes = await syncRunnaCalendar(user.id);
          userResult.runna = { synced: syncRes.synced };
          runnaSynced = syncRes.synced > 0 || syncRes.removed > 0;
          await prisma.syncLog.create({
            data: {
              userId: user.id,
              triggeredBy: "cron",
              status: "success",
              itemsSynced: syncRes.synced,
              startedAt: sourceStarted,
              finishedAt: new Date(),
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown Runna error";
          userResult.runna = { error: message };
          await prisma.syncLog.create({
            data: {
              userId: user.id,
              triggeredBy: "cron",
              status: "error",
              error: message,
              startedAt: sourceStarted,
              finishedAt: new Date(),
            },
          });
        }
      }
    } catch (err) {
      // Ignore user profile missing error
    }

    // ─── Plan matching ──────────────────────────────────────────────────────
    // Run only if at least one sync brought new data
    const stravaSynced =
      userResult.strava && "synced" in userResult.strava && userResult.strava.synced > 0;
    const hevySynced =
      userResult.hevy && "synced" in userResult.hevy && userResult.hevy.synced > 0;

    if (stravaSynced || hevySynced || runnaSynced) {
      try {
        const result = await matchPlanSessions(user.id);
        userResult.matched = result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Match error";
        userResult.matched = { error: message };
      }
    }

    results.push(userResult);
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  return Response.json({
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    processed: usersToSync.length,
    results,
  });
}

// Vercel Cron uses GET; allow POST for manual testing
export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

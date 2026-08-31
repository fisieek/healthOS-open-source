import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { backfillStravaDetails } from "@/lib/services/strava";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds

/**
 * POST /api/strava/backfill?limit=50&force=false
 *
 * Re-fetches detailed activity payloads + streams for already-synced activities
 * that are missing them. Useful after schema upgrades or for older history.
 *
 * Strava rate limit: 100 requests / 15 min, 1000 / day. We process up to `limit`
 * activities (each = 2 requests). Default 50 = 100 requests = whole 15-min budget.
 * Run again later to continue if there's more.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
  const force = searchParams.get("force") === "true";

  const startedAt = new Date();
  try {
    const result = await backfillStravaDetails(session.user.id, { limit, force });
    await prisma.syncLog.create({
      data: {
        userId: session.user.id,
        triggeredBy: "manual",
        status: result.errors > 0 ? "partial" : "success",
        itemsSynced: result.processed,
        startedAt,
        finishedAt: new Date(),
      },
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.syncLog.create({
      data: {
        userId: session.user.id,
        triggeredBy: "manual",
        status: "error",
        error: message,
        startedAt,
        finishedAt: new Date(),
      },
    });
    return Response.json({ error: message }, { status: 500 });
  }
}

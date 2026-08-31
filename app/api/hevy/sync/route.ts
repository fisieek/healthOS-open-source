import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { syncHevyWorkouts } from "@/lib/services/hevy";
import { matchPlanSessions } from "@/lib/services/plan-matcher";
import { DataSourceType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.HEVY } },
    select: { id: true, accessToken: true, isActive: true },
  });

  if (!source || !source.accessToken || !source.isActive) {
    return Response.json(
      { error: "Hevy not configured", code: "NOT_CONFIGURED" },
      { status: 412 }
    );
  }

  const startedAt = new Date();
  const syncLog = await prisma.syncLog.create({
    data: {
      userId,
      dataSourceId: source.id,
      triggeredBy: "manual",
      status: "running",
      startedAt,
    },
  });

  try {
    const { synced } = await syncHevyWorkouts(userId);

    // Auto-rematch plan sessions if any new workouts were imported
    let planUpdated = 0;
    if (synced > 0) {
      const result = await matchPlanSessions(userId);
      planUpdated = result.updated;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "success", itemsSynced: synced, finishedAt: new Date() },
    });

    return Response.json({ synced, planUpdated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    return Response.json({ error: message }, { status: 500 });
  }
}

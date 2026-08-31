import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { syncStravaActivities } from "@/lib/services/strava";
import { matchPlanSessions } from "@/lib/services/plan-matcher";
import { DataSourceType } from "@/app/generated/prisma/client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const startedAt = new Date();

  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.STRAVA } },
    select: { isActive: true },
  });

  if (!source || !source.isActive) {
    return NextResponse.json(
      { error: "Strava not connected", code: "NOT_CONNECTED" },
      { status: 412 }
    );
  }

  try {
    const count = await syncStravaActivities(userId);

    // Auto-rematch plan sessions if any new activities were imported
    let planUpdated = 0;
    if (count > 0) {
      const result = await matchPlanSessions(userId);
      planUpdated = result.updated;
    }

    await prisma.syncLog.create({
      data: {
        userId,
        triggeredBy: "manual",
        status: "success",
        itemsSynced: count,
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ synced: count, planUpdated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.syncLog.create({
      data: {
        userId,
        triggeredBy: "manual",
        status: "error",
        error: message,
        startedAt,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = await prisma.dataSource.findUnique({
    where: {
      userId_type: { userId: session.user.id, type: DataSourceType.STRAVA },
    },
    select: { isActive: true, lastSyncedAt: true },
  });

  return NextResponse.json({
    connected: !!source?.isActive,
    lastSyncedAt: source?.lastSyncedAt ?? null,
  });
}

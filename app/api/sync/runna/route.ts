import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { syncRunnaCalendar } from "@/lib/services/runna";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const startedAt = new Date();

  try {
    const result = await syncRunnaCalendar(userId);

    // Zapisujemy log do bazy jako sukces
    await prisma.syncLog.create({
      data: {
        userId,
        triggeredBy: "manual",
        status: "success",
        itemsSynced: result.synced,
        startedAt,
        finishedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      synced: result.synced,
      removed: result.removed,
      skipped: result.skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd synchronizacji Runna";

    // Zapisujemy log jako błąd
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

    return Response.json({ error: message }, { status: 500 });
  }
}

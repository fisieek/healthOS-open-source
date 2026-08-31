import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ActivityType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/plan?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns plan sessions in window (default: this week + next 4 weeks).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = {
    userId: session.user.id,
  };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const sessions = await prisma.trainingPlanSession.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      statuses: {
        include: {
          activity: { select: { id: true, name: true, distance: true, duration: true, type: true } },
          strengthWorkout: { select: { id: true, name: true, volume: true, duration: true } },
        },
      },
    },
  });

  return Response.json(sessions);
}

interface CreatePlanInput {
  date: string;
  type: ActivityType;
  name: string;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetVolume?: number | null;
  notes?: string | null;
  recurrence?: "NONE" | "WEEKLY";
  recurrenceWeeks?: number; // ile tygodni do przodu generować (default 12)
}

/**
 * POST /api/plan
 * Body: CreatePlanInput | CreatePlanInput[]  (single or batch)
 *
 * Jeśli `recurrence: "WEEKLY"`, generuje pojedynczy `seriesId` i tworzy N
 * wystąpień co tydzień (default 12 tygodni). Każde wystąpienie dziedziczy
 * wszystkie parametry.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const items: CreatePlanInput[] = Array.isArray(body) ? body : [body];

  for (const item of items) {
    if (!item.date || !item.type || !item.name) {
      return Response.json(
        { error: "date, type and name are required" },
        { status: 400 }
      );
    }
  }

  // Generuj wszystkie wystąpienia (single + recurring)
  const toCreate: any[] = [];
  for (const item of items) {
    const recurrence = item.recurrence ?? "NONE";
    const baseDate = new Date(item.date);
    const isRecurring = recurrence === "WEEKLY";
    const weeks = isRecurring ? Math.min(Math.max(item.recurrenceWeeks ?? 12, 1), 52) : 1;
    const seriesId = isRecurring
      ? Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, "0")).join("")
      : null;

    for (let i = 0; i < weeks; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i * 7);
      toCreate.push({
        userId: session.user!.id!,
        date: d,
        type: item.type,
        name: item.name,
        targetDistance: item.targetDistance ?? null,
        targetDuration: item.targetDuration ?? null,
        targetVolume: item.targetVolume ?? null,
        notes: item.notes ?? null,
        seriesId,
        recurrence,
      });
    }
  }

  const created = await prisma.$transaction(
    toCreate.map((data) => prisma.trainingPlanSession.create({ data }))
  );

  return Response.json(Array.isArray(body) ? created : created[0], { status: 201 });
}

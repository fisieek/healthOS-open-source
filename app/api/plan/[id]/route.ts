import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ActivityType, SessionStatus } from "@/app/generated/prisma/client";
import { overridePlanStatus } from "@/lib/services/plan-matcher";

export const runtime = "nodejs";

async function ensureOwnership(id: string, userId: string): Promise<boolean> {
  const p = await prisma.trainingPlanSession.findUnique({
    where: { id },
    select: { userId: true },
  });
  return !!p && p.userId === userId;
}

interface UpdateInput {
  date?: string;
  type?: ActivityType;
  name?: string;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetVolume?: number | null;
  notes?: string | null;
  // Status override (separate concern but bundled for convenience)
  status?: SessionStatus;
  activityId?: string | null;
  strengthId?: string | null;
  // Scope dla recurring: "single" (default) lub "future" — wszystkie przyszłe wystąpienia w serii (włącznie z tym)
  scope?: "single" | "future";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await ensureOwnership(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateInput;
  const scope = body.scope ?? "single";

  // 1) Pole danych do aktualizacji
  const planData: Record<string, unknown> = {};
  if (body.date !== undefined) planData.date = new Date(body.date);
  if (body.type !== undefined) planData.type = body.type;
  if (body.name !== undefined) planData.name = body.name;
  if (body.targetDistance !== undefined) planData.targetDistance = body.targetDistance;
  if (body.targetDuration !== undefined) planData.targetDuration = body.targetDuration;
  if (body.targetVolume !== undefined) planData.targetVolume = body.targetVolume;
  if (body.notes !== undefined) planData.notes = body.notes;

  if (Object.keys(planData).length > 0) {
    if (scope === "future") {
      // Aktualizuj wszystkie przyszłe wystąpienia z tym samym seriesId (włącznie z bieżącym).
      // UWAGA: zmiana `date` w trybie future nie ma sensu (przesuwa pojedyncze wystąpienie),
      // więc dla "future" pomijamy zmianę date.
      const current = await prisma.trainingPlanSession.findUnique({
        where: { id },
        select: { seriesId: true, date: true },
      });
      if (current?.seriesId) {
        const futureUpdate: Record<string, unknown> = { ...planData };
        delete futureUpdate.date; // date update only for single scope
        await prisma.trainingPlanSession.updateMany({
          where: {
            userId: session.user.id,
            seriesId: current.seriesId,
            date: { gte: current.date },
          },
          data: futureUpdate,
        });
        // Jeśli była zmiana daty, zastosuj ją tylko do bieżącego rekordu
        if (planData.date !== undefined) {
          await prisma.trainingPlanSession.update({
            where: { id },
            data: { date: planData.date as Date },
          });
        }
      } else {
        // Brak serii — traktuj jak single
        await prisma.trainingPlanSession.update({ where: { id }, data: planData });
      }
    } else {
      // Single — odepnij od serii (bo zmiana wpływa tylko na to wystąpienie)
      const willEditNonStatusField = body.name !== undefined ||
        body.type !== undefined ||
        body.targetDistance !== undefined ||
        body.targetDuration !== undefined ||
        body.targetVolume !== undefined ||
        body.notes !== undefined;

      if (willEditNonStatusField) {
        planData.seriesId = null;
        planData.recurrence = "NONE";
      }
      await prisma.trainingPlanSession.update({ where: { id }, data: planData });
    }
  }

  // 2) Status override
  if (body.status !== undefined) {
    await overridePlanStatus(session.user.id, id, {
      status: body.status,
      activityId: body.activityId,
      strengthId: body.strengthId,
    });
  }

  const updated = await prisma.trainingPlanSession.findUnique({
    where: { id },
    include: {
      statuses: {
        include: {
          activity: { select: { id: true, name: true } },
          strengthWorkout: { select: { id: true, name: true } },
        },
      },
    },
  });

  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await ensureOwnership(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Scope query param: ?scope=single|future
  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") as "single" | "future") ?? "single";

  if (scope === "future") {
    const current = await prisma.trainingPlanSession.findUnique({
      where: { id },
      select: { seriesId: true, date: true },
    });
    if (current?.seriesId) {
      await prisma.trainingPlanSession.deleteMany({
        where: {
          userId: session.user.id,
          seriesId: current.seriesId,
          date: { gte: current.date },
        },
      });
      return Response.json({ ok: true, scope: "future" });
    }
  }

  await prisma.trainingPlanSession.delete({ where: { id } });
  return Response.json({ ok: true, scope: "single" });
}

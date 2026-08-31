import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export const runtime = "nodejs";

/**
 * POST /api/health/supplements/:id/intake
 * Body: { date?: "YYYY-MM-DD", portion?: 0.5 | 1 | 2 }
 * Default: today, portion = 1.
 * Idempotent? No — multiple intakes per day allowed (e.g. morning + evening).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: supplementId } = await params;

  const sup = await prisma.supplement.findUnique({
    where: { id: supplementId },
    select: { userId: true },
  });
  if (!sup || sup.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    portion?: number;
    notes?: string;
  };

  const dateStr = body.date ?? new Date().toISOString().slice(0, 10);
  const portion = typeof body.portion === "number" && body.portion > 0 ? body.portion : 1;

  const intake = await prisma.supplementIntake.create({
    data: {
      userId: session.user.id,
      supplementId,
      date: new Date(dateStr),
      portion,
      notes: body.notes || null,
    },
  });

  return Response.json(intake, { status: 201 });
}

/**
 * DELETE /api/health/supplements/:id/intake?intakeId=xxx
 * Removes a specific intake record.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: supplementId } = await params;
  const url = new URL(request.url);
  const intakeId = url.searchParams.get("intakeId");
  const dateStr = url.searchParams.get("date");

  if (!intakeId && !dateStr) {
    return Response.json({ error: "intakeId or date query param required" }, { status: 400 });
  }

  if (intakeId) {
    const intake = await prisma.supplementIntake.findUnique({
      where: { id: intakeId },
      select: { userId: true, supplementId: true },
    });
    if (!intake || intake.userId !== session.user.id || intake.supplementId !== supplementId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.supplementIntake.delete({ where: { id: intakeId } });
    return Response.json({ ok: true });
  } else {
    // dateStr is present
    const queryDate = new Date(dateStr!);
    const startOfQueryDate = startOfDay(queryDate);
    const endOfQueryDate = endOfDay(queryDate);

    await prisma.supplementIntake.deleteMany({
      where: {
        userId: session.user.id,
        supplementId,
        date: {
          gte: startOfQueryDate,
          lte: endOfQueryDate,
        },
      },
    });
    return Response.json({ ok: true });
  }
}

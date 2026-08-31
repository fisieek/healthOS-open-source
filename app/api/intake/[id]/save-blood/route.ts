import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { IntakeKind, IntakeStatus } from "@/app/generated/prisma";
import { addYears } from "date-fns";

export const runtime = "nodejs";

interface SaveBloodInput {
  title: string;
  type: string; // BLOOD_TEST, HORMONES, URINE_TEST, etc.
  studyDate: string; // YYYY-MM-DD
  laboratory?: string | null;
  doctor?: string | null;
  description?: string | null;
  tags?: string[];
  parameters: Record<string, { value: string; unit?: string }>;
}

/**
 * POST /api/intake/<id>/save-blood
 *
 * Accepts user-reviewed blood/urine/hormone test results,
 * creates or updates a HealthDocument, and links it to the intake.
 * Marks the intake status as REVIEWED.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: intakeId } = await params;

  const intake = await prisma.healthIntake.findUnique({
    where: { id: intakeId },
    select: {
      id: true,
      userId: true,
      kind: true,
      healthDocumentId: true,
      storageUrl: true,
      storageKey: true,
    },
  });

  if (!intake || intake.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let updatedKind = intake.kind;
  if (intake.kind !== IntakeKind.BLOOD_TEST && intake.kind !== IntakeKind.HORMONES_TEST) {
    // If a bypass/force action occurred, we allow saving by dynamically upgrading the intake's kind to BLOOD_TEST
    updatedKind = IntakeKind.BLOOD_TEST;
  }

  const body = (await request.json()) as SaveBloodInput;
  if (!body.title) return Response.json({ error: "title is required" }, { status: 400 });
  if (!body.studyDate) return Response.json({ error: "studyDate is required" }, { status: 400 });
  if (!body.type) return Response.json({ error: "type is required" }, { status: 400 });

  const data = {
    userId: session.user.id,
    title: body.title.trim(),
    type: body.type.trim(),
    studyDate: new Date(body.studyDate),
    laboratory: body.laboratory?.trim() || null,
    doctor: body.doctor?.trim() || null,
    description: body.description?.trim() || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    fileUrl: intake.storageUrl || null,
    parameters: body.parameters && Object.keys(body.parameters).length > 0 ? body.parameters : null,
  };

  let document;
  if (intake.healthDocumentId) {
    document = await prisma.healthDocument.update({
      where: { id: intake.healthDocumentId },
      data: data as any,
    });
  } else {
    document = await prisma.healthDocument.create({
      data: data as any,
    });
  }

  await prisma.healthIntake.update({
    where: { id: intakeId },
    data: {
      healthDocumentId: document.id,
      status: IntakeStatus.REVIEWED,
      kind: updatedKind,
    },
  });

  // ── Auto-create cyclic reminder habit for next blood test ──────────────
  try {
    const testDate = new Date(body.studyDate);
    const habitName = "Badania krwi — przypomnienie";

    let habit = await prisma.habit.findFirst({
      where: { userId: session.user.id, name: habitName },
    });

    if (!habit) {
      habit = await prisma.habit.create({
        data: {
          userId: session.user.id,
          name: habitName,
          type: "BOOLEAN",
          frequency: "YEARLY",
          isActive: true,
          order: 101,
        },
      });
    }

    // Mark test date as completed
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date: testDate } },
      update: { completed: true },
      create: { habitId: habit.id, date: testDate, completed: true },
    });

    // Schedule next reminder as uncompleted log for next year in the same habit
    const nextTestDate = addYears(testDate, 1);
    await prisma.habitLog.upsert({
      where: {
        habitId_date: { habitId: habit.id, date: nextTestDate },
      },
      update: {},
      create: {
        habitId: habit.id,
        date: nextTestDate,
        completed: false,
        notes: `Zaplanowane po badaniu z dnia ${body.studyDate}`,
      },
    });
  } catch (err) {
    console.error("[save-blood] Failed to create blood test reminder:", err);
  }

  return Response.json({
    documentId: document.id,
    intakeId,
    fileUrl: document.fileUrl,
  });
}

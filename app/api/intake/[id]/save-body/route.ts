import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  IntakeKind,
  IntakeStatus,
  Prisma,
} from "@/app/generated/prisma";
import { storage } from "@/lib/services/storage";

export const runtime = "nodejs";

interface SaveBodyInput {
  date: string; // YYYY-MM-DD
  measuredAt?: string | null;
  sourceLabel?: string | null;
  weight?: number | null;
  bmi?: number | null;
  bodyFat?: number | null;
  leanBodyMass?: number | null;
  muscleMass?: number | null;
  boneMass?: number | null;
  bodyWaterPct?: number | null;
  proteinPct?: number | null;
  visceralFat?: number | null;
  basalMetabolism?: number | null;
  metabolicAge?: number | null;
  bodyType?: string | null;
  bodyScore?: number | null;
  idealWeight?: number | null;
  skeletalMusclePct?: number | null;
  height?: number | null;
  notes?: string | null;
  // Nowe pola
  waterMass?: number | null;
  fatMass?: number | null;
  proteinMass?: number | null;
  musclePct?: number | null;
  bonePct?: number | null;
  skeletalMuscleMass?: number | null;
  waistToHipRatio?: number | null;
}

/**
 * POST /api/intake/<id>/save-body
 *
 * Accepts user-reviewed body composition data and creates/updates a
 * BodyMeasurement linked to the intake. Marks intake as REVIEWED.
 *
 * Re-saving on the same intake updates the existing BodyMeasurement.
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
      bodyMeasurementId: true,
      storageKey: true,
      storageUrl: true,
      classification: true,
    },
  });
  if (!intake || intake.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (intake.kind !== IntakeKind.BODY_COMPOSITION) {
    return Response.json(
      { error: `Intake kind is ${intake.kind ?? "null"}, expected BODY_COMPOSITION` },
      { status: 400 }
    );
  }

  const body = (await request.json()) as SaveBodyInput;
  if (!body.date) return Response.json({ error: "date is required" }, { status: 400 });

  const data = {
    userId: session.user.id,
    date: new Date(body.date),
    measuredAt: body.measuredAt ? new Date(body.measuredAt) : null,
    sourceLabel: body.sourceLabel ?? null,
    weight: body.weight ?? null,
    bmi: body.bmi ?? null,
    bodyFat: body.bodyFat ?? null,
    leanBodyMass: body.leanBodyMass ?? null,
    muscleMass: body.muscleMass ?? null,
    boneMass: body.boneMass ?? null,
    bodyWaterPct: body.bodyWaterPct ?? null,
    proteinPct: body.proteinPct ?? null,
    visceralFat: body.visceralFat ?? null,
    basalMetabolism: body.basalMetabolism ?? null,
    metabolicAge: body.metabolicAge ?? null,
    bodyType: body.bodyType ?? null,
    bodyScore: body.bodyScore ?? null,
    idealWeight: body.idealWeight ?? null,
    skeletalMusclePct: body.skeletalMusclePct ?? null,
    height: body.height ?? null,
    notes: body.notes ?? null,
    source: "PHOTO",
    photoUrl: intake.storageUrl,
    photoKey: intake.storageKey,
    extractedAt: new Date(),
    rawExtraction: intake.classification ?? Prisma.JsonNull,
    // Nowe pola
    waterMass: body.waterMass ?? null,
    fatMass: body.fatMass ?? null,
    proteinMass: body.proteinMass ?? null,
    musclePct: body.musclePct ?? null,
    bonePct: body.bonePct ?? null,
    skeletalMuscleMass: body.skeletalMuscleMass ?? null,
    waistToHipRatio: body.waistToHipRatio ?? null,
  };

  let measurement;
  if (intake.bodyMeasurementId) {
    measurement = await prisma.bodyMeasurement.update({
      where: { id: intake.bodyMeasurementId },
      data: {
        ...data,
      },
    });
  } else {
    measurement = await prisma.bodyMeasurement.create({ data });
  }

  await prisma.healthIntake.update({
    where: { id: intakeId },
    data: {
      bodyMeasurementId: measurement.id,
      status: IntakeStatus.REVIEWED,
    },
  });

  return Response.json({
    measurementId: measurement.id,
    intakeId,
    photoUrl: intake.storageUrl,
  });
}

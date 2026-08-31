import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/services/storage";
import { Prisma } from "@/app/generated/prisma";

export const runtime = "nodejs";

interface PatchInput {
  date?: string;
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
  // Nowe wskaźniki
  waterMass?: number | null;
  fatMass?: number | null;
  proteinMass?: number | null;
  musclePct?: number | null;
  bonePct?: number | null;
  skeletalMuscleMass?: number | null;
  waistToHipRatio?: number | null;
}

async function ensureOwnership(id: string, userId: string) {
  const m = await prisma.bodyMeasurement.findUnique({
    where: { id },
    select: { userId: true },
  });
  return !!m && m.userId === userId;
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

  const body = (await request.json()) as PatchInput;

  const data: Prisma.BodyMeasurementUpdateInput = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.measuredAt !== undefined)
    data.measuredAt = body.measuredAt ? new Date(body.measuredAt) : null;
  if (body.sourceLabel !== undefined) data.sourceLabel = body.sourceLabel;
  if (body.weight !== undefined) data.weight = body.weight;
  if (body.bmi !== undefined) data.bmi = body.bmi;
  if (body.bodyFat !== undefined) data.bodyFat = body.bodyFat;
  if (body.leanBodyMass !== undefined) data.leanBodyMass = body.leanBodyMass;
  if (body.muscleMass !== undefined) data.muscleMass = body.muscleMass;
  if (body.boneMass !== undefined) data.boneMass = body.boneMass;
  if (body.bodyWaterPct !== undefined) data.bodyWaterPct = body.bodyWaterPct;
  if (body.proteinPct !== undefined) data.proteinPct = body.proteinPct;
  if (body.visceralFat !== undefined) data.visceralFat = body.visceralFat;
  if (body.basalMetabolism !== undefined) data.basalMetabolism = body.basalMetabolism;
  if (body.metabolicAge !== undefined) data.metabolicAge = body.metabolicAge;
  if (body.bodyType !== undefined) data.bodyType = body.bodyType;
  if (body.bodyScore !== undefined) data.bodyScore = body.bodyScore;
  if (body.idealWeight !== undefined) data.idealWeight = body.idealWeight;
  if (body.skeletalMusclePct !== undefined) data.skeletalMusclePct = body.skeletalMusclePct;
  if (body.height !== undefined) data.height = body.height;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.waterMass !== undefined) data.waterMass = body.waterMass;
  if (body.fatMass !== undefined) data.fatMass = body.fatMass;
  if (body.proteinMass !== undefined) data.proteinMass = body.proteinMass;
  if (body.musclePct !== undefined) data.musclePct = body.musclePct;
  if (body.bonePct !== undefined) data.bonePct = body.bonePct;
  if (body.skeletalMuscleMass !== undefined) data.skeletalMuscleMass = body.skeletalMuscleMass;
  if (body.waistToHipRatio !== undefined) data.waistToHipRatio = body.waistToHipRatio;

  const updated = await prisma.bodyMeasurement.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const m = await prisma.bodyMeasurement.findUnique({
    where: { id },
    select: { userId: true, photoKey: true },
  });
  if (!m || m.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Delete file from storage if it exists.
  if (m.photoKey) {
    await storage.delete(m.photoKey).catch(() => undefined);
  }
  await prisma.bodyMeasurement.delete({ where: { id } });

  return Response.json({ ok: true });
}

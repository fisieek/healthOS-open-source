import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/services/storage";
import { IntakeStatus } from "@/app/generated/prisma";

export const runtime = "nodejs";

/**
 * GET /api/intake/<id> — fetch intake row (incl. classification JSON)
 * PATCH /api/intake/<id> { status: "REJECTED" } — mark as rejected (file kept)
 * DELETE /api/intake/<id> — delete record + storage file (BodyMeasurement is preserved)
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const intake = await prisma.healthIntake.findUnique({
    where: { id },
  });
  if (!intake || intake.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(intake);
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

  const intake = await prisma.healthIntake.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!intake || intake.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { status?: IntakeStatus; notes?: string | null };
  const data: { status?: IntakeStatus; notes?: string | null } = {};
  if (body.status) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await prisma.healthIntake.update({ where: { id }, data });
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

  const intake = await prisma.healthIntake.findUnique({
    where: { id },
    select: { userId: true, storageKey: true },
  });
  if (!intake || intake.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await storage.delete(intake.storageKey).catch(() => undefined);
  await prisma.healthIntake.delete({ where: { id } });

  return Response.json({ ok: true });
}

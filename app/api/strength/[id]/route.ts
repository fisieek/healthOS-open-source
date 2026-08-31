import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma";

export const runtime = "nodejs";

interface PatchInput {
  moodScore?: number | null;
  moodNote?: string | null;
}

async function ensureOwnership(id: string, userId: string): Promise<boolean> {
  const w = await prisma.strengthWorkout.findUnique({
    where: { id },
    select: { userId: true },
  });
  return !!w && w.userId === userId;
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
  if (body.moodScore != null && (body.moodScore < 1 || body.moodScore > 5)) {
    return Response.json({ error: "moodScore must be 1-5" }, { status: 400 });
  }

  const data: Prisma.StrengthWorkoutUpdateInput = {};
  if (body.moodScore !== undefined) data.moodScore = body.moodScore;
  if (body.moodNote !== undefined) data.moodNote = body.moodNote;

  if (Object.keys(data).length > 0) {
    await prisma.strengthWorkout.update({ where: { id }, data });
  }

  const updated = await prisma.strengthWorkout.findUnique({ where: { id } });
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

  await prisma.strengthWorkout.delete({
    where: { id },
  });

  return Response.json({ success: true });
}

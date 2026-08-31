import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HealthEventType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.healthEvent.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { type, date, title, description, documentId } = body;

  if (type) {
    const validTypes = Object.values(HealthEventType);
    if (!validTypes.includes(type)) {
      return Response.json({ error: "Invalid event type" }, { status: 400 });
    }
  }

  const event = await prisma.healthEvent.update({
    where: { id },
    data: {
      ...(type && { type }),
      ...(date && { date: new Date(date) }),
      ...(title && { title: title.trim() }),
      ...(description !== undefined && {
        description: description?.trim() || null,
      }),
      ...(documentId !== undefined && { documentId: documentId || null }),
    },
    include: { document: { select: { id: true, title: true } } },
  });

  return Response.json(event);
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

  const existing = await prisma.healthEvent.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.healthEvent.delete({ where: { id } });
  return Response.json({ ok: true });
}

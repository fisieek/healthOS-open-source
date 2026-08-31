import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HealthEventType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.healthEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    include: { document: { select: { id: true, title: true } } },
  });

  return Response.json(events);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, date, title, description, documentId } = body;

  if (!type || !date || !title) {
    return Response.json(
      { error: "type, date, and title are required" },
      { status: 400 }
    );
  }

  const validTypes = Object.values(HealthEventType);
  if (!validTypes.includes(type)) {
    return Response.json({ error: "Invalid event type" }, { status: 400 });
  }

  const event = await prisma.healthEvent.create({
    data: {
      userId: session.user.id,
      type,
      date: new Date(date),
      title: title.trim(),
      description: description?.trim() || null,
      documentId: documentId || null,
    },
    include: { document: { select: { id: true, title: true } } },
  });

  return Response.json(event, { status: 201 });
}

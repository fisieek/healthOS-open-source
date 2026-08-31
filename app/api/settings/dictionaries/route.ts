import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ActivityType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subtypes = await prisma.activitySubtype.findMany({
    where: { userId: session.user.id },
    orderBy: [{ parentType: "asc" }, { order: "asc" }],
  });

  return Response.json(subtypes);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { parentType, name, icon, color, order } = body;

  if (!parentType || !name) {
    return Response.json({ error: "parentType and name are required" }, { status: 400 });
  }

  // Walidacja parentType z enuma
  if (!Object.values(ActivityType).includes(parentType)) {
    return Response.json({ error: "Invalid parentType" }, { status: 400 });
  }

  const subtype = await prisma.activitySubtype.create({
    data: {
      userId: session.user.id,
      parentType,
      name: name.trim(),
      icon: icon ? icon.trim() : null,
      color: color ? color.trim() : null,
      order: order ? parseInt(order, 10) : 0,
    },
  });

  return Response.json(subtype, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id parameter is required" }, { status: 400 });
  }

  const subtype = await prisma.activitySubtype.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!subtype || subtype.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.activitySubtype.delete({ where: { id } });
  return Response.json({ ok: true });
}

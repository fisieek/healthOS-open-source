import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

/**
 * PATCH /api/settings/datasource/:type
 * Body: { isActive: boolean }
 *
 * Toggle auto-sync (isActive) for a data source.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type: typeParam } = await params;
  const upperType = typeParam.toUpperCase();

  // Validate type
  const validTypes = Object.values(DataSourceType);
  if (!validTypes.includes(upperType as DataSourceType)) {
    return Response.json({ error: "Invalid data source type" }, { status: 400 });
  }
  const dsType = upperType as DataSourceType;

  const body = (await request.json()) as { isActive?: boolean };
  if (typeof body.isActive !== "boolean") {
    return Response.json({ error: "isActive (boolean) is required" }, { status: 400 });
  }

  const existing = await prisma.dataSource.findUnique({
    where: { userId_type: { userId: session.user.id, type: dsType } },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Data source not connected" }, { status: 404 });
  }

  const updated = await prisma.dataSource.update({
    where: { userId_type: { userId: session.user.id, type: dsType } },
    data: { isActive: body.isActive },
    select: { type: true, isActive: true, lastSyncedAt: true },
  });

  return Response.json(updated);
}

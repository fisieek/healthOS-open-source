import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const dataSources = await prisma.dataSource.findMany({
    where: { userId },
    select: { type: true, isActive: true, lastSyncedAt: true },
  });

  return NextResponse.json({ dataSources });
}

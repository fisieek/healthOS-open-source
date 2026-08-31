import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/health/nutrients
 * Returns the canonical nutrient catalog.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nutrients = await prisma.nutrient.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return Response.json(nutrients);
}

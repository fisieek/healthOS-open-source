import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getAllNutrients, matchNutrient } from "@/lib/services/nutrients";

export const runtime = "nodejs";

interface IngredientInput {
  name: string;
  amount?: number | null;
  unit?: string | null;
  percentDV?: number | null;
  nutrientId?: string | null;
}

async function ensureOwnership(id: string, userId: string): Promise<boolean> {
  const sup = await prisma.supplement.findUnique({ where: { id }, select: { userId: true } });
  return !!sup && sup.userId === userId;
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

  const body = await request.json();
  const {
    name,
    productName,
    company,
    dose,
    servingSize,
    servingUnit,
    goal,
    startDate,
    endDate,
    notes,
    ingredients, // if provided, replaces existing ingredients
  } = body;

  // Build update data only for keys present in payload
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim();
  if (productName !== undefined) data.productName = productName || null;
  if (company !== undefined) data.company = company || null;
  if (dose !== undefined) data.dose = dose || null;
  if (servingSize !== undefined) data.servingSize = servingSize === null || servingSize === "" ? null : Number(servingSize);
  if (servingUnit !== undefined) data.servingUnit = servingUnit || null;
  if (goal !== undefined) data.goal = goal || null;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (notes !== undefined) data.notes = notes || null;

  // If ingredients array provided, replace them transactionally
  if (Array.isArray(ingredients)) {
    const nutrients = await getAllNutrients();
    const creates = (ingredients as IngredientInput[]).map((ing) => ({
      name: ing.name,
      amount: ing.amount ?? null,
      unit: ing.unit ?? null,
      percentDV: ing.percentDV ?? null,
      nutrientId: ing.nutrientId ?? matchNutrient(ing.name, nutrients)?.id ?? null,
    }));

    await prisma.$transaction([
      prisma.supplementIngredient.deleteMany({ where: { supplementId: id } }),
      prisma.supplement.update({
        where: { id },
        data: {
          ...data,
          ingredients: creates.length ? { create: creates } : undefined,
        },
      }),
    ]);
  } else {
    await prisma.supplement.update({ where: { id }, data });
  }

  const updated = await prisma.supplement.findUnique({
    where: { id },
    include: {
      ingredients: {
        orderBy: { name: "asc" },
        include: { nutrient: { select: { id: true, slug: true, name: true } } },
      },
    },
  });

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
  if (!(await ensureOwnership(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.supplement.delete({ where: { id } });
  return Response.json({ ok: true });
}

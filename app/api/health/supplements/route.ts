import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getAllNutrients, matchNutrient } from "@/lib/services/nutrients";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supplements = await prisma.supplement.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
    include: {
      ingredients: {
        orderBy: { name: "asc" },
        include: { nutrient: { select: { id: true, slug: true, name: true } } },
      },
    },
  });

  return Response.json(supplements);
}

interface IngredientInput {
  name: string;
  amount?: number | null;
  unit?: string | null;
  percentDV?: number | null;
  nutrientId?: string | null; // optional explicit override
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    ingredients,
  } = body;

  if (!name || !startDate) {
    return Response.json({ error: "name and startDate are required" }, { status: 400 });
  }

  const nutrients = await getAllNutrients();
  const ingredientCreates = (ingredients as IngredientInput[] | undefined)?.map((ing) => {
    const nutrientId = ing.nutrientId ?? matchNutrient(ing.name, nutrients)?.id ?? null;
    return {
      name: ing.name,
      amount: ing.amount ?? null,
      unit: ing.unit ?? null,
      percentDV: ing.percentDV ?? null,
      nutrientId,
    };
  });

  const supplement = await prisma.supplement.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      productName: productName || null,
      company: company || null,
      dose: dose || null,
      servingSize: servingSize != null ? Number(servingSize) : null,
      servingUnit: servingUnit || null,
      goal: goal || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || null,
      ingredients: ingredientCreates?.length ? { create: ingredientCreates } : undefined,
    },
    include: {
      ingredients: {
        include: { nutrient: { select: { id: true, slug: true, name: true } } },
      },
    },
  });

  return Response.json(supplement, { status: 201 });
}

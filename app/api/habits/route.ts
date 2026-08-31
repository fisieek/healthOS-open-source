import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HabitType, HabitFrequency } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/habits
 * Pobiera listę aktywnych nawyków na DZIŚ (lub na ?date=YYYY-MM-DD).
 * Aktywny = isActive AND validTo IS NULL.
 *
 * ?activeOnly=true (default true) — tylko aktualnie aktywne
 * ?activeOnly=false — pełna historia (włącznie z usuniętymi/zarchiwizowanymi)
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("activeOnly") !== "false";

  const where: any = { userId: session.user.id };
  if (activeOnly) {
    where.isActive = true;
    where.validTo = null;
  }

  const habits = await prisma.habit.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return Response.json(habits);
}

/**
 * POST /api/habits
 * Tworzy nowy nawyk z validFrom = dziś.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, type, targetValue, unit, frequency, intervalDays, step, order } = body;

    if (!name || !type || !frequency) {
      return Response.json(
        { error: "Pola 'name', 'type' oraz 'frequency' są wymagane." },
        { status: 400 }
      );
    }

    if (!Object.values(HabitType).includes(type)) {
      return Response.json({ error: "Nieprawidłowy typ nawyku." }, { status: 400 });
    }
    if (!Object.values(HabitFrequency).includes(frequency)) {
      return Response.json({ error: "Nieprawidłowa częstotliwość nawyku." }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newHabit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        name,
        type: type as HabitType,
        targetValue: targetValue != null ? parseFloat(targetValue) : null,
        unit: unit || null,
        frequency: frequency as HabitFrequency,
        intervalDays: intervalDays ? parseInt(intervalDays) : null,
        step: step != null ? parseFloat(step) : null,
        validFrom: today,
        order: order ? parseInt(order) : 0,
      },
    });

    return Response.json(newHabit, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

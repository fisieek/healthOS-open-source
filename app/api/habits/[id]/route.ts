import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { HabitType, HabitFrequency } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/habits/[id]
 * "Edycja" — wersjonowanie:
 *   1. Stary nawyk dostaje validTo = today (przestaje obowiązywać od dziś)
 *   2. Tworzymy nowy Habit z tymi samymi userId i parametrami z body, validFrom = today
 *
 * Zachowujemy historyczne logi przy starym nawyku.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, type, targetValue, unit, frequency, intervalDays, step, isActive, order } = body;

    const existing = await prisma.habit.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Nie znaleziono nawyku." }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (type !== undefined && !Object.values(HabitType).includes(type)) {
      return Response.json({ error: "Nieprawidłowy typ." }, { status: 400 });
    }
    if (frequency !== undefined && !Object.values(HabitFrequency).includes(frequency)) {
      return Response.json({ error: "Nieprawidłowa częstotliwość." }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Wersjonowanie: zamknij stary, utwórz nowy
    const result = await prisma.$transaction(async (tx) => {
      // 1. Zamknij stary
      await tx.habit.update({
        where: { id },
        data: { validTo: today, isActive: false },
      });

      // 2. Utwórz nowy z parametrami (merge: nowe wartości lub stare)
      const created = await tx.habit.create({
        data: {
          userId: existing.userId,
          name: name ?? existing.name,
          type: (type ?? existing.type) as HabitType,
          targetValue: targetValue !== undefined
            ? (targetValue !== null ? parseFloat(targetValue) : null)
            : existing.targetValue,
          unit: unit !== undefined ? unit : existing.unit,
          frequency: (frequency ?? existing.frequency) as HabitFrequency,
          intervalDays: intervalDays !== undefined
            ? (intervalDays !== null ? parseInt(intervalDays) : null)
            : existing.intervalDays,
          step: step !== undefined
            ? (step !== null ? parseFloat(step) : null)
            : existing.step,
          isActive: isActive !== undefined ? !!isActive : true,
          order: order !== undefined ? parseInt(order) : existing.order,
          validFrom: today,
        },
      });

      return created;
    });

    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/habits/[id]
 * Soft delete: ustawia validTo = today, isActive = false.
 * Logi historyczne pozostają (nie kasowane fizycznie).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.habit.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Nie znaleziono nawyku." }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.habit.update({
      where: { id },
      data: { validTo: today, isActive: false },
    });

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

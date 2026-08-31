import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addMonths, addYears } from "date-fns";

export const runtime = "nodejs";

/**
 * POST /api/health/blood-reminder
 * Body: { lastTestDate: string (YYYY-MM-DD), intervalMonths?: number }
 *
 * Tworzy lub aktualizuje nawyk-przypomnienie o badaniach krwi.
 * Domyślny interwał: 12 miesięcy (raz w roku).
 * Tworzy HabitLog na datę następnego badania (niezaznaczony).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { lastTestDate, intervalMonths = 12 } = body;

    if (!lastTestDate) {
      return Response.json({ error: "lastTestDate is required" }, { status: 400 });
    }

    const lastDate = new Date(lastTestDate);
    const nextDate =
      intervalMonths >= 12
        ? addYears(lastDate, Math.floor(intervalMonths / 12))
        : addMonths(lastDate, intervalMonths);

    const habitName = "Badania krwi — przypomnienie";

    // Find or create the reminder habit
    let habit = await prisma.habit.findFirst({
      where: { userId, name: habitName },
    });

    if (!habit) {
      habit = await prisma.habit.create({
        data: {
          userId,
          name: habitName,
          type: "BOOLEAN",
          frequency: "YEARLY",
          isActive: true,
          order: 101,
        },
      });
    }

    // Mark last test date as completed
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date: lastDate } },
      update: { completed: true },
      create: { habitId: habit.id, date: lastDate, completed: true },
    });

    // Schedule next reminder as uncompleted log
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date: nextDate } },
      update: {},
      create: {
        habitId: habit.id,
        date: nextDate,
        completed: false,
        notes: `Zaplanowane badania (co ${intervalMonths} mies.) — poprzednie: ${lastTestDate}`,
      },
    });

    return Response.json({
      ok: true,
      habitId: habit.id,
      nextReminderDate: nextDate.toISOString().split("T")[0],
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

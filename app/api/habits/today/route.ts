import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export const runtime = "nodejs";

/**
 * GET /api/habits/today?date=YYYY-MM-DD
 * Zwraca listę nawyków aktywnych na dany dzień wraz z ich statusem wykonania (HabitLog).
 * Zwraca również zaplanowane treningi na ten dzień.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const queryDate = new Date(dateStr);

  const userId = session.user.id;

  try {
    // 1. Pobierz wszystkie aktywne nawyki obowiązujące na queryDate
    //    (validFrom <= queryDate AND (validTo IS NULL OR validTo > queryDate))
    //    LUB nawyki, które mają log na ten dzień (zachowanie historyczne)
    const habits = await prisma.habit.findMany({
      where: {
        userId,
        OR: [
          {
            isActive: true,
            AND: [
              { OR: [{ validFrom: null }, { validFrom: { lte: queryDate } }] },
              { OR: [{ validTo: null }, { validTo: { gt: queryDate } }] },
            ],
          },
          { logs: { some: { date: queryDate } } },
        ],
      },
      orderBy: [
        { order: "asc" },
        { createdAt: "asc" }
      ],
      include: {
        logs: {
          where: { date: queryDate }
        }
      }
    });

    // Zmapuj nawyki na bardziej płaską strukturę dla frontendu
    const habitTasks = habits.map(h => {
      const log = h.logs[0] || null;
      return {
        id: h.id,
        name: h.name,
        type: h.type,
        targetValue: h.targetValue,
        unit: h.unit,
        frequency: h.frequency,
        step: h.step,
        completed: log ? log.completed : false,
        value: log ? log.value : null,
        notes: log ? log.notes : null,
        logId: log ? log.id : null,
      };
    });

    // 2. Pobierz zaplanowany trening na dziś
    const plannedWorkouts = await prisma.trainingPlanSession.findMany({
      where: {
        userId,
        date: queryDate
      },
      include: {
        statuses: {
          include: {
            activity: { select: { id: true, name: true, distance: true, duration: true, type: true } },
            strengthWorkout: { select: { id: true, name: true, volume: true, duration: true } }
          }
        }
      }
    });

    // 3. Pobierz dzisiejsze samopoczucie (wellness)
    const wellness = await prisma.wellnessEntry.findFirst({
      where: {
        userId,
        date: queryDate
      }
    });

    // 4. Pobierz dzisiejszy sen (sleep)
    const sleep = await prisma.sleepSession.findFirst({
      where: {
        userId,
        date: queryDate
      }
    });

    // 5. Pobierz aktywne suplementy na ten dzień wraz z dzisiejszymi przyjęciami (intakes)
    const startOfQueryDate = startOfDay(queryDate);
    const endOfQueryDate = endOfDay(queryDate);

    const activeSupplements = await prisma.supplement.findMany({
      where: {
        userId,
        startDate: { lte: endOfQueryDate },
        OR: [
          { endDate: null },
          { endDate: { gte: startOfQueryDate } }
        ]
      },
      include: {
        intakes: {
          where: {
            date: { gte: startOfQueryDate, lte: endOfQueryDate }
          }
        }
      }
    });

    const supplementTasks = activeSupplements.map(s => {
      const todayPortion = s.intakes.reduce((acc, val) => acc + val.portion, 0);
      return {
        id: s.id,
        name: s.name,
        company: s.company,
        servingSize: s.servingSize,
        servingUnit: s.servingUnit,
        completed: todayPortion > 0,
        value: todayPortion,
      };
    });

    const thirtyDaysLater = new Date(queryDate);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const activeReferrals = await prisma.referral.findMany({
      where: {
        userId,
        isUsed: false,
        expiryDate: {
          gte: startOfQueryDate,
          lte: endOfDay(thirtyDaysLater),
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    return Response.json({
      date: dateStr,
      habits: habitTasks,
      plannedWorkouts,
      wellness,
      sleep,
      supplements: supplementTasks,
      activeReferrals,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/habits/today
 * Body: { habitId: string, date: string (YYYY-MM-DD), completed: boolean, value?: number, notes?: string }
 * Zapisuje lub aktualizuje (upsert) wykonanie nawyku.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { habitId, date, completed, value, notes } = body;

    if (!habitId || !date) {
      return Response.json({ error: "Pola 'habitId' oraz 'date' są wymagane." }, { status: 400 });
    }

    const queryDate = new Date(date);

    // Sprawdź czy nawyk istnieje i należy do użytkownika
    const habit = await prisma.habit.findUnique({
      where: { id: habitId }
    });

    if (!habit || habit.userId !== session.user.id) {
      return Response.json({ error: "Nie znaleziono nawyku lub brak dostępu." }, { status: 404 });
    }

    // Wykonaj upsert logu
    const log = await prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: queryDate
        }
      },
      update: {
        completed: !!completed,
        value: value !== undefined ? (value !== null ? parseFloat(value) : null) : undefined,
        notes: notes !== undefined ? notes : undefined
      },
      create: {
        habitId,
        date: queryDate,
        completed: !!completed,
        value: value !== null && value !== undefined ? parseFloat(value) : null,
        notes: notes || null
      }
    });

    return Response.json(log);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

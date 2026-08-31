import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { subDays, subMonths } from "date-fns";
import { ActivityType } from "@/app/generated/prisma";
import { calculateTrainingStress, calculatePersonalBestsRuns, calculatePersonalBestsLifts } from "@/lib/services/training-analytics";
import { getVolumeStats, getVo2maxTrend, getPaceRecords, getHrZonesSummary } from "@/lib/services/running-stats";

export const getRecentActivities = (userId: string) => tool({
  description: "Pobiera listę ostatnich aktywności kardio/wytrzymałościowych (np. biegi, kolarstwo, pływanie) użytkownika.",
  inputSchema: z.object({
    days: z.number().describe("Liczba dni wstecz do pobrania aktywności (np. 7, 14, 30)").optional().default(14),
    type: z.enum(["RUN", "RIDE", "SWIM", "OTHER"]).describe("Filtrowanie po typie aktywności").optional(),
  }),
  execute: async ({ days, type }: any) => {
    try {
      const limitDate = subDays(new Date(), days);
      const whereClause: any = {
        userId,
        startedAt: { gte: limitDate },
      };
      if (type) {
        whereClause.type = type;
      }
      const data = await prisma.activity.findMany({
        where: whereClause,
        orderBy: { startedAt: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania aktywności." };
    }
  },
});

export const getRecentStrengthWorkouts = (userId: string) => tool({
  description: "Pobiera historię treningów siłowych użytkownika z ostatnich N dni (ćwiczenia, serie, ciężary, objętość).",
  inputSchema: z.object({
    days: z.number().describe("Liczba dni wstecz do pobrania treningów (np. 7, 14, 30)").optional().default(14),
  }),
  execute: async ({ days }: any) => {
    try {
      const limitDate = subDays(new Date(), days);
      const data = await prisma.strengthWorkout.findMany({
        where: {
          userId,
          startedAt: { gte: limitDate },
        },
        include: {
          exercises: {
            include: {
              sets: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania treningów siłowych." };
    }
  },
});

export const getTrainingLoad = (userId: string) => tool({
  description: "Pobiera analitykę obciążeń treningowych użytkownika: poziom zmęczenia (ATL), formy (CTL) oraz bilansu (TSB). Zwraca interpretację stanu regeneracji.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const now = new Date();
      const past150Days = subDays(now, 150);

      const activities = await prisma.activity.findMany({
        where: { userId, startedAt: { gte: past150Days } },
        select: {
          id: true,
          type: true,
          startedAt: true,
          duration: true,
          distance: true,
          avgHr: true,
          maxHr: true,
          sufferScore: true,
        },
      });

      const strengthWorkouts = await prisma.strengthWorkout.findMany({
        where: { userId, startedAt: { gte: past150Days } },
        select: {
          id: true,
          startedAt: true,
          duration: true,
          volume: true,
        },
      });

      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { maxHr: true },
      });

      const maxHr = profile?.maxHr ?? 190;
      const points = calculateTrainingStress(
        activities.map(a => ({
          id: a.id,
          type: a.type,
          startedAt: a.startedAt,
          duration: a.duration,
          distance: a.distance,
          avgHr: a.avgHr,
          maxHr: a.maxHr,
          sufferScore: a.sufferScore,
        })),
        strengthWorkouts.map(w => ({
          id: w.id,
          startedAt: w.startedAt,
          duration: w.duration,
          volume: w.volume,
        })),
        30, // return last 30 days of trend
        maxHr
      );

      const latest = points[points.length - 1];

      let state = "Zrównoważony";
      let description = "Twoje zmęczenie i forma są w optymalnej relacji.";
      if (latest) {
        if (latest.tsb < -30) {
          state = "Przeciążenie / Ryzyko Przetrenowania";
          description = "Wysokie ryzyko kontuzji i spadku odporności. Konieczna natychmiastowa regeneracja lub deload.";
        } else if (latest.tsb < -10) {
          state = "Stymulujący Trening (Optimal Training)";
          description = "Budujesz formę aerobową i siłową. Monitoruj sen i regenerację.";
        } else if (latest.tsb > 10) {
          state = "Świeżość (Tapering / Roztrenowanie)";
          description = "Jesteś w pełni zregenerowany, gotowy na zawody lub testy maksów.";
        }
      }

      return {
        current: latest || null,
        state,
        description,
        trend: points,
      };
    } catch (error: any) {
      return { error: error.message || "Błąd podczas obliczania obciążeń treningowych." };
    }
  },
});

export const getRunningStats = (userId: string) => tool({
  description: "Pobiera szczegółowe statystyki biegowe użytkownika: objętość (dystans tygodniowy), regularność, trend VO2max (VDOT) oraz rekordy.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const volume = await getVolumeStats(userId);
      const vo2max = await getVo2maxTrend(userId, 12);
      const records = await getPaceRecords(userId);

      return {
        volume,
        vo2maxTrend: vo2max,
        records,
      };
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania statystyk biegowych." };
    }
  },
});

export const getPersonalBestsRuns = (userId: string) => tool({
  description: "Pobiera najlepsze wyniki życiowe (rekordy życiowe) użytkownika w biegach na standardowych dystansach (1 km, 5 km, 10 km, półmaraton).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const activities = await prisma.activity.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          startedAt: true,
          duration: true,
          distance: true,
          avgHr: true,
          maxHr: true,
          sufferScore: true,
          name: true,
        },
      });

      const records = calculatePersonalBestsRuns(
        activities.map(a => ({
          id: a.id,
          type: a.type,
          startedAt: a.startedAt,
          duration: a.duration,
          distance: a.distance,
          avgHr: a.avgHr,
          maxHr: a.maxHr,
          sufferScore: a.sufferScore,
          name: a.name,
        } as any))
      );

      return records;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania rekordów biegowych." };
    }
  },
});

export const getPersonalBestsLifts = (userId: string) => tool({
  description: "Pobiera rekordy życiowe w bojach siłowych (np. szacowane 1RM dla przysiadu, martwego ciągu, wyciskania leżąc itp.).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const strengthWorkouts = await prisma.strengthWorkout.findMany({
        where: { userId },
        include: {
          exercises: {
            include: {
              sets: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
      });

      const records = calculatePersonalBestsLifts(
        strengthWorkouts.map(w => ({
          id: w.id,
          startedAt: w.startedAt,
          exercises: w.exercises.map(e => ({
            id: e.id,
            name: e.name,
            sets: e.sets.map(s => ({
              weight: s.weight ?? 0,
              reps: s.reps ?? 0,
            })),
          })),
        }))
      );

      return records;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas obliczania rekordów siłowych." };
    }
  },
});

export const getTrainingPlan = (userId: string) => tool({
  description: "Pobiera zaplanowane sesje treningowe użytkownika na najbliższe/ostatnie N dni wraz ze statusem ich realizacji (PLANNED, DONE, MISSED itp.).",
  inputSchema: z.object({
    days: z.number().describe("Liczba dni w przód/tył").optional().default(14),
  }),
  execute: async ({ days }: any) => {
    try {
      const now = new Date();
      const limitDatePast = subDays(now, Math.floor(days / 2));
      const limitDateFuture = subDays(now, -Math.floor(days / 2));

      const data = await prisma.trainingPlanSession.findMany({
        where: {
          userId,
          date: { gte: limitDatePast, lte: limitDateFuture },
        },
        include: {
          statuses: true,
        },
        orderBy: { date: "asc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania planu treningowego." };
    }
  },
});

export const getHrZonesConfig = (userId: string) => tool({
  description: "Pobiera konfigurację stref tętna użytkownika (przedziały bpm i opis stref).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: {
          maxHr: true,
          restingHr: true,
          lthr: true,
          zonesMethod: true,
        },
      });

      if (!profile) {
        return { error: "Brak profilu użytkownika." };
      }

      // Proste wyliczenie stref tętna w oparciu o maxHr (domyślny procentowy podział)
      const maxHr = profile.maxHr ?? 190;
      const zones = {
        Z1: { min: Math.round(maxHr * 0.5), max: Math.round(maxHr * 0.6), name: "Active Recovery (Aktywna Regeneracja)" },
        Z2: { min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7), name: "Aerobic Capacity (Tlenowa / Spalanie tłuszczu)" },
        Z3: { min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8), name: "Tempo (Mieszana)" },
        Z4: { min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9), name: "Lactate Threshold (Próg mleczanowy)" },
        Z5: { min: Math.round(maxHr * 0.9), max: maxHr, name: "Anaerobic Capacity (Beztlenowa / Maksymalny wysiłek)" },
      };

      return {
        method: profile.zonesMethod,
        maxHr,
        restingHr: profile.restingHr,
        lthr: profile.lthr,
        zones,
      };
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania konfiguracji stref tętna." };
    }
  },
});

export const getActivityDetails = (userId: string) => tool({
  description: "Pobiera szczegółowe statystyki oraz dane o strefach tętna dla jednej konkretnej aktywności o podanym ID.",
  inputSchema: z.object({
    activityId: z.string().describe("Unikalne ID aktywności z bazy"),
  }),
  execute: async ({ activityId }: any) => {
    try {
      const data = await prisma.activity.findUnique({
        where: { id: activityId },
      });

      if (!data || data.userId !== userId) {
        return { error: "Nie znaleziono aktywności lub brak dostępu." };
      }

      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania szczegółów aktywności." };
    }
  },
});

export const getStrengthExerciseProgress = (userId: string) => tool({
  description: "Pobiera historię postępów (ciężary i objętość) dla konkretnego ćwiczenia siłowego z ostatnich N miesięcy.",
  inputSchema: z.object({
    exerciseName: z.string().describe("Nazwa ćwiczenia siłowego (np. 'Bench Press', 'Squat')"),
    months: z.number().describe("Liczba miesięcy wstecz do analizy").optional().default(6),
  }),
  execute: async ({ exerciseName, months }: any) => {
    try {
      const limitDate = subMonths(new Date(), months);

      // Szukamy wszystkich serii dla danego ćwiczenia
      const exercises = await prisma.strengthExercise.findMany({
        where: {
          workout: {
            userId,
            startedAt: { gte: limitDate },
          },
          name: { contains: exerciseName },
        },
        include: {
          sets: true,
          workout: {
            select: {
              startedAt: true,
              name: true,
            },
          },
        },
        orderBy: {
          workout: {
            startedAt: "asc",
          },
        },
      });

      const progress = exercises.map(ex => {
        const sets = ex.sets;
        const maxWeight = sets.reduce((max, s) => Math.max(max, s.weight ?? 0), 0);
        const totalVolume = sets.reduce((sum, s) => sum + ((s.weight ?? 0) * (s.reps ?? 0)), 0);
        const maxReps = sets.reduce((max, s) => Math.max(max, s.reps ?? 0), 0);

        return {
          date: ex.workout.startedAt,
          workoutName: ex.workout.name,
          maxWeight,
          totalVolume,
          maxReps,
          setsCount: sets.length,
        };
      });

      return { exercise: exerciseName, progress };
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania progresu ćwiczenia siłowego." };
    }
  },
});

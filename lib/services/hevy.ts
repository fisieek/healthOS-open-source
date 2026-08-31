import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";
import { mapOrRegisterExercise } from "./exercise-dictionary";

const HEVY_BASE = "https://api.hevyapp.com/v1";

interface HevySet {
  index: number;
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  rpe: number | null;
}

interface HevyExercise {
  index: number;
  title: string;
  notes: string;
  sets: HevySet[];
}

interface HevyWorkout {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  exercises: HevyExercise[];
}

interface HevyWorkoutsResponse {
  page: number;
  page_count: number;
  workouts: HevyWorkout[];
}

async function fetchWorkoutsPage(
  apiKey: string,
  page: number
): Promise<HevyWorkoutsResponse> {
  const res = await fetch(
    `${HEVY_BASE}/workouts?page=${page}&pageSize=10`,
    { headers: { "api-key": apiKey, "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hevy API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function syncHevyWorkouts(userId: string): Promise<{ synced: number }> {
  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.HEVY } },
    select: { id: true, accessToken: true, lastSyncedAt: true },
  });

  if (!source?.accessToken) throw new Error("Hevy API key not configured");

  const apiKey = source.accessToken;
  let page = 1;
  let totalPages = 1;
  let synced = 0;

  do {
    const data = await fetchWorkoutsPage(apiKey, page);
    totalPages = data.page_count;

    for (const w of data.workouts) {
      const startedAt = new Date(w.start_time);

      // skip already-synced if incremental
      if (source.lastSyncedAt && startedAt <= source.lastSyncedAt) continue;

      const durationSec = w.end_time
        ? Math.round(
            (new Date(w.end_time).getTime() - startedAt.getTime()) / 1000
          )
        : null;

      // compute total volume (sum of weight * reps across all sets)
      let volume = 0;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (s.weight_kg && s.reps) volume += s.weight_kg * s.reps;
        }
      }

      const workout = await prisma.strengthWorkout.upsert({
        where: { userId_sourceId: { userId, sourceId: w.id } },
        create: {
          userId,
          sourceId: w.id,
          name: w.title || "Trening",
          startedAt,
          duration: durationSec,
          volume: volume > 0 ? volume : null,
          notes: w.description || null,
        },
        update: {
          name: w.title || "Trening",
          startedAt,
          duration: durationSec,
          volume: volume > 0 ? volume : null,
          notes: w.description || null,
        },
      });

      // delete and recreate exercises (simplest way to keep in sync)
      await prisma.strengthExercise.deleteMany({ where: { workoutId: workout.id } });

      for (const ex of w.exercises) {
        // Mapuj na słownik ćwiczeń (lub zarejestruj nowe)
        const mapped = await mapOrRegisterExercise(userId, ex.title, ex.sets.map(s => ({
          weight: s.weight_kg,
          reps: s.reps,
          duration: s.duration_seconds,
        })));

        const exercise = await prisma.strengthExercise.create({
          data: {
            workoutId: workout.id,
            name: ex.title,
            notes: ex.notes || null,
            order: ex.index,
            exerciseDefinitionId: mapped.exerciseDefinitionId,
          },
        });

        // detect PRs: find max weight for this exercise across all previous workouts
        const prevMax = await prisma.strengthSet.findFirst({
          where: {
            exercise: { name: ex.title, workout: { userId, startedAt: { lt: startedAt } } },
            weight: { not: null },
          },
          orderBy: { weight: "desc" },
          select: { weight: true },
        });
        const previousMaxWeight = prevMax?.weight ?? 0;

        for (const s of ex.sets) {
          const isPr =
            s.weight_kg != null &&
            s.reps != null &&
            s.reps > 0 &&
            s.weight_kg > previousMaxWeight;

          await prisma.strengthSet.create({
            data: {
              exerciseId: exercise.id,
              setNumber: s.index + 1,
              reps: s.reps,
              weight: s.weight_kg,
              duration: s.duration_seconds,
              rpe: s.rpe,
              isPr,
            },
          });
        }
      }

      synced++;
    }

    page++;
  } while (page <= totalPages);

  await prisma.dataSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  return { synced };
}

export async function saveHevyApiKey(userId: string, apiKey: string): Promise<void> {
  await prisma.dataSource.upsert({
    where: { userId_type: { userId, type: DataSourceType.HEVY } },
    create: {
      userId,
      type: DataSourceType.HEVY,
      accessToken: apiKey,
      isActive: true,
    },
    update: {
      accessToken: apiKey,
      isActive: true,
    },
  });
}

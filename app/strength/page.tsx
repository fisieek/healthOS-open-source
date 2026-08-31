import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getMuscleGroup, MuscleGroup } from "@/lib/services/muscle-groups";
import StrengthDashboard from "@/components/strength/strength-dashboard";

export default async function StrengthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // 1. Pobieramy WSZYSTKIE treningi chronologicznie (od najstarszego do najnowszego)
  // do wyliczenia baseline progresu oraz precyzyjnych rekordów w historii.
  const workouts = await prisma.strengthWorkout.findMany({
    where: { userId },
    orderBy: { startedAt: "asc" },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: {
          sets: { orderBy: { setNumber: "asc" } },
          exerciseDefinition: true,
        },
      },
    },
  });

  // Metryki ogólne
  const totalWorkouts = workouts.length;
  const totalVolume = workouts.reduce((sum, w) => sum + (w.volume ?? 0), 0);
  const totalPrs = workouts.reduce((sum, w) => {
    return sum + w.exercises.reduce((exSum, ex) => {
      return exSum + ex.sets.filter(s => s.isPr).length;
    }, 0);
  }, 0);

  // 2. Wykres tonażu — ostatnie 12 tygodni wstecz od dziś
  const now = new Date();
  // Znajdź początek bieżącego tygodnia (poniedziałek)
  const todayDow = now.getDay(); // 0=niedziela
  const daysToMonday = todayDow === 0 ? 6 : todayDow - 1;
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - daysToMonday);
  thisWeekMonday.setHours(0, 0, 0, 0);

  const weeklyVolumeData: { weekLabel: string; volume: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const wStart = new Date(thisWeekMonday);
    wStart.setDate(thisWeekMonday.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    wEnd.setHours(23, 59, 59, 999);

    // Etykieta: "Wxx" wg numeru tygodnia ISO lub krótka data dd.MM
    const day = String(wStart.getDate()).padStart(2, '0');
    const month = String(wStart.getMonth() + 1).padStart(2, '0');
    const weekLabel = `${day}.${month}`;

    const volume = workouts
      .filter(w => {
        const d = new Date(w.startedAt);
        return d >= wStart && d <= wEnd;
      })
      .reduce((sum, w) => sum + (w.volume ?? 0), 0);

    weeklyVolumeData.push({ weekLabel, volume });
  }

  // 3. Objętość (tonaż) z ostatnich 4 tygodni per grupa (do mapy ciała — legacy, używane przez RecordsGrid)
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const emptyMuscleRecord = (): Record<MuscleGroup, number> => ({
    CHEST: 0, BACK: 0, LEGS: 0, SHOULDERS: 0, BICEPS: 0,
    TRICEPS: 0, CORE: 0, CALVES: 0, FOREARMS: 0,
    CARDIO: 0, PLYO: 0, STRETCHING: 0, OTHER: 0,
  });

  const muscleVolumes = emptyMuscleRecord();

  workouts
    .filter(w => new Date(w.startedAt) >= fourWeeksAgo)
    .forEach(w => {
      w.exercises.forEach(ex => {
        const group = (ex.exerciseDefinition?.muscleGroup as MuscleGroup) || getMuscleGroup(ex.name);
        const exVolume = ex.sets.reduce((sum, s) => sum + ((s.weight ?? 0) * (s.reps ?? 0)), 0);
        muscleVolumes[group] += exVolume;
      });
    });

  // 3b. Liczba serii per partia w 4 oknach czasowych (do heatmapy)
  const now2 = new Date();
  const cutoffs = {
    week: new Date(now2.getTime() - 7 * 24 * 60 * 60 * 1000),
    month: new Date(now2.getTime() - 30 * 24 * 60 * 60 * 1000),
    year: new Date(now2.getTime() - 365 * 24 * 60 * 60 * 1000),
    all: new Date(0),
  };

  const muscleSetCounts: Record<'week' | 'month' | 'year' | 'all', Record<MuscleGroup, number>> = {
    week: emptyMuscleRecord(),
    month: emptyMuscleRecord(),
    year: emptyMuscleRecord(),
    all: emptyMuscleRecord(),
  };

  workouts.forEach(w => {
    const wDate = new Date(w.startedAt);
    w.exercises.forEach(ex => {
      const group = (ex.exerciseDefinition?.muscleGroup as MuscleGroup) || getMuscleGroup(ex.name);
      const setCount = ex.sets.length;
      if (wDate >= cutoffs.week)  muscleSetCounts.week[group]  += setCount;
      if (wDate >= cutoffs.month) muscleSetCounts.month[group] += setCount;
      if (wDate >= cutoffs.year)  muscleSetCounts.year[group]  += setCount;
      muscleSetCounts.all[group] += setCount;
    });
  });

  // 4. Rekordy życiowe per 9 partii (bez OTHER)
  const records: Partial<Record<MuscleGroup, any>> = {};

  workouts.forEach(w => {
    w.exercises.forEach(ex => {
      const group = (ex.exerciseDefinition?.muscleGroup as MuscleGroup) || getMuscleGroup(ex.name);
      if (group === "OTHER") return;

      ex.sets.forEach(s => {
        // For CORE: use volume (weight × reps) as proxy since many core exercises are bodyweight
        const e1RM = s.weight && s.reps
          ? (s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30))
          : (s.reps ? s.reps : 0); // bodyweight: use reps as score

        if (e1RM > 0) {
          const currentRecord = records[group];
          if (!currentRecord || e1RM > currentRecord.e1RM) {
            records[group] = {
              exerciseName: ex.name,
              weight: s.weight ?? 0,
              reps: s.reps ?? 0,
              e1RM: e1RM,
              date: new Date(w.startedAt),
              sparklineData: []
            };
          }
        }
      });
    });
  });

  // Uzupełnienie 5 ostatnich tonaży per partia (sparkline) — 9 grup
  const keyGroups: Exclude<MuscleGroup, 'OTHER'>[] = ['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'CORE', 'CALVES', 'FOREARMS'];

  keyGroups.forEach(group => {
    const workoutsWithGroup = [...workouts]
      .reverse()
      .filter(w => w.exercises.some(ex => ((ex.exerciseDefinition?.muscleGroup as MuscleGroup) || getMuscleGroup(ex.name)) === group));

    const latest5 = workoutsWithGroup.slice(0, 5);

    const sparklineData = latest5.map(w => {
      return w.exercises
        .filter(ex => ((ex.exerciseDefinition?.muscleGroup as MuscleGroup) || getMuscleGroup(ex.name)) === group)
        .reduce((exSum, ex) => {
          return exSum + ex.sets.reduce((setSum, s) => setSum + ((s.weight ?? 0) * (s.reps ?? 0)), 0);
        }, 0);
    });

    sparklineData.reverse();

    if (records[group]) {
      records[group].sparklineData = sparklineData;
    }
  });

  // 5. Analiza progresu od baseline dla każdego ćwiczenia
  const baselineMap = new Map<string, number>();

  const processedWorkouts = workouts.map(w => {
    const processedExercises = w.exercises.map(ex => {
      const group = (ex.exerciseDefinition?.muscleGroup as MuscleGroup) || getMuscleGroup(ex.name);

      const processedSets = ex.sets.map(s => {
        const e1RM = s.weight && s.reps
          ? (s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30))
          : 0;
        return {
          id: s.id,
          setNumber: s.setNumber,
          weight: s.weight,
          reps: s.reps,
          duration: s.duration,
          isPr: s.isPr,
          e1RM
        };
      });

      const maxSessionE1RM = Math.max(...processedSets.map(s => s.e1RM), 0);
      const exerciseKey = ex.name.toLowerCase().trim();

      let progressFromBaseline: number | null = null;
      if (maxSessionE1RM > 0) {
        if (!baselineMap.has(exerciseKey)) {
          baselineMap.set(exerciseKey, maxSessionE1RM);
        } else {
          const baselineVal = baselineMap.get(exerciseKey)!;
          if (baselineVal > 0) {
            progressFromBaseline = ((maxSessionE1RM - baselineVal) / baselineVal) * 100;
          }
        }
      }

      let determinedType = ex.exerciseDefinition?.type;
      if (!determinedType) {
        const hasDuration = ex.sets.some(s => s.duration && s.duration > 0);
        const hasWeight = ex.sets.some(s => s.weight && s.weight > 0);
        if (hasDuration) determinedType = "DURATION";
        else if (!hasWeight) determinedType = "REPS_ONLY";
        else determinedType = "REPS_WEIGHT";
      }

      return {
        id: ex.id,
        name: ex.name,
        muscleGroup: group,
        type: determinedType,
        sets: processedSets,
        bestE1RM: maxSessionE1RM,
        progressFromBaseline
      };
    });

    const calculatedVolume = processedExercises.reduce((exSum, ex) => {
      const isWeightBased = ex.type === "REPS_WEIGHT";
      if (!isWeightBased) return exSum;
      return exSum + ex.sets.reduce((setSum, s) => setSum + ((s.weight ?? 0) * (s.reps ?? 0)), 0);
    }, 0);

    return {
      id: w.id,
      name: w.name,
      startedAt: w.startedAt,
      duration: w.duration,
      volume: w.volume ?? calculatedVolume,
      moodScore: w.moodScore,
      exercises: processedExercises
    };
  });

  // Odwracamy chronologicznie (najnowsze na górze)
  const workoutsDesc = [...processedWorkouts].reverse();

  // Konwersja dat do stringów ISO dla klienta
  const workoutsForClient = workoutsDesc.map(w => ({
    ...w,
    startedAt: new Date(w.startedAt).toISOString(),
    exercises: w.exercises.map(ex => ({
      ...ex,
      type: ex.type,
      sets: ex.sets.map(s => ({
        ...s,
        weight: s.weight,
        reps: s.reps,
        duration: s.duration
      }))
    }))
  }));

  return (
    <StrengthDashboard
      initialWorkouts={workoutsForClient}
      initialMuscleVolumes={muscleVolumes}
      muscleSetCounts={muscleSetCounts}
      initialRecords={records}
      totalWorkouts={totalWorkouts}
      totalVolume={totalVolume}
      totalPrs={totalPrs}
      weeklyVolumeData={weeklyVolumeData}
    />
  );
}

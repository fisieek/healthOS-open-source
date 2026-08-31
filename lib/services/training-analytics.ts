import { format, subDays, parseISO, differenceInDays } from "date-fns";

export interface ActivityTssData {
  id: string;
  type: string; // RUN, RIDE, SWIM, STRENGTH, etc.
  startedAt: string | Date;
  duration: number; // seconds
  distance?: number | null; // meters
  avgHr?: number | null;
  maxHr?: number | null;
  sufferScore?: number | null;
  volume?: number | null; // total weight for strength
}

export interface TrainingStressPoint {
  date: string;
  formattedDate: string;
  ctl: number;
  atl: number;
  tsb: number;
  tss: number;
}

export interface PersonalBestRun {
  distanceLabel: string;
  recordValue: string; // formatted time or pace
  date: string;
  activityId: string;
  activityName: string;
  rawSeconds: number;
}

export interface PersonalBestLift {
  exerciseName: string;
  oneRepMax: number; // kg
  weight: number; // kg
  reps: number;
  date: string;
  workoutId: string;
}

/**
 * Oblicza TSS (Training Stress Score) dla pojedynczej aktywności.
 */
export function calculateActivityTss(activity: ActivityTssData, maxHrUser = 190): number {
  const durationHours = activity.duration / 3600;

  // 1. Jeśli to trening siłowy
  if (activity.type === "STRENGTH" || activity.type === "WEIGHT_TRAINING") {
    // Siłownia: średnio 45 TSS na godzinę
    return Math.round(activity.duration / 60 * 0.75);
  }

  // 2. Jeśli mamy sufferScore ze Stravy
  if (activity.sufferScore != null && activity.sufferScore > 0) {
    return activity.sufferScore;
  }

  // 3. Jeśli mamy dane tętna
  if (activity.avgHr != null && activity.avgHr > 0) {
    const maxHr = activity.maxHr || maxHrUser;
    const intensity = activity.avgHr / maxHr;
    // Kwadrat intensywności daje nieliniowy wzrost zmęczenia przy wyższym tętnie
    const tssFactor = Math.pow(intensity, 2) * 100;
    return Math.round(durationHours * tssFactor);
  }

  // 4. Domyślne oszacowanie (np. 50 TSS/h dla średnio-intensywnego biegu/kardio)
  const defaultFactor = activity.type === "RIDE" ? 40 : 50;
  return Math.round(durationHours * defaultFactor);
}

/**
 * Generuje chronologiczną tablicę punktów stresu treningowego (CTL, ATL, TSB).
 * Zaczyna obliczenia od 130 dni przed dzisiaj, aby ustabilizować CTL/ATL,
 * ale zwraca tylko zafiltrowane dane (np. ostatnie 30/90/180 dni).
 */
export function calculateTrainingStress(
  activities: ActivityTssData[],
  strengthWorkouts: { id: string; startedAt: string | Date; duration?: number | null; volume?: number | null }[],
  daysToReturn = 90,
  maxHrUser = 190
): TrainingStressPoint[] {
  const today = new Date();
  // Zaczynamy liczyć 150 dni temu, żeby chroniczna średnia (42 dni) zdążyła się ustabilizować
  const startDate = subDays(today, daysToReturn + 60);

  // 1. Zmapujmy aktywności na TSS i zgrupujmy po dniach (YYYY-MM-DD)
  const dailyTss: Record<string, number> = {};

  // Przetwarzanie aktywności kardio
  for (const act of activities) {
    const dateKey = format(new Date(act.startedAt), "yyyy-MM-dd");
    const tss = calculateActivityTss(act, maxHrUser);
    dailyTss[dateKey] = (dailyTss[dateKey] || 0) + tss;
  }

  // Przetwarzanie treningów siłowych
  for (const w of strengthWorkouts) {
    const dateKey = format(new Date(w.startedAt), "yyyy-MM-dd");
    const duration = w.duration || 3600; // domyślnie 1h
    const tss = calculateActivityTss({
      id: w.id,
      type: "STRENGTH",
      startedAt: w.startedAt,
      duration,
      volume: w.volume
    });
    dailyTss[dateKey] = (dailyTss[dateKey] || 0) + tss;
  }

  // 2. Iterujemy chronologicznie dzień po dniu od startDate do dzisiaj
  const totalDays = differenceInDays(today, startDate) + 1;
  const allPoints: TrainingStressPoint[] = [];

  let currentCtl = 0; // Chronic Training Load (forma)
  let currentAtl = 0; // Acute Training Load (zmęczenie)

  for (let i = 0; i <= totalDays; i++) {
    const date = subDays(today, totalDays - i);
    const dateKey = format(date, "yyyy-MM-dd");
    const tss = dailyTss[dateKey] || 0;

    // Klasyczne wzory modelowania zmęczenia i formy (Banister / Coggan)
    // CTL = CTL_prev + (TSS - CTL_prev) / 42
    // ATL = ATL_prev + (TSS - ATL_prev) / 7
    currentCtl = currentCtl + (tss - currentCtl) / 42;
    currentAtl = currentAtl + (tss - currentAtl) / 7;
    const tsb = currentCtl - currentAtl;

    allPoints.push({
      date: dateKey,
      formattedDate: format(date, "dd.MM"),
      ctl: Math.round(currentCtl * 10) / 10,
      atl: Math.round(currentAtl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      tss
    });
  }

  // Zwracamy tylko zafiltrowany zakres dni (ostatnie N dni)
  return allPoints.slice(-daysToReturn);
}

/**
 * Formatuje czas trwania w sekundach do formatu MM:SS lub HH:MM:SS
 */
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

/**
 * Wykrywa rekordy życiowe (PR) na dystansach biegowych (1km, 5km, 10km)
 */
export function calculatePersonalBestsRuns(activities: ActivityTssData[]): PersonalBestRun[] {
  const runs = activities.filter(
    (a) => a.type === "RUN" && a.distance && a.distance > 0 && a.duration > 0
  );

  const bests: Record<string, PersonalBestRun> = {};

  const checkAndSetBest = (key: string, label: string, seconds: number, act: ActivityTssData) => {
    if (!bests[key] || seconds < bests[key].rawSeconds) {
      bests[key] = {
        distanceLabel: label,
        recordValue: formatDuration(seconds),
        date: format(new Date(act.startedAt), "dd.MM.yyyy"),
        activityId: act.id,
        activityName: (act as any).name || "Bieg",
        rawSeconds: seconds,
      };
    }
  };

  for (const r of runs) {
    const dist = r.distance || 0;
    const pace = (r as any).avgPace || (r.duration / (dist / 1000)); // sekundy na km

    // Najlepsze tempo / czas na 1 km (tempo na km z całej aktywności)
    if (dist >= 1000) {
      // Szacujemy 1km na podstawie tempa
      checkAndSetBest("1k", "Najszybszy 1 km", pace, r);
    }

    // Najlepszy czas na 5 km
    if (dist >= 4900 && dist <= 6000) {
      const est5k = (5000 / dist) * r.duration;
      checkAndSetBest("5k", "Najszybsze 5 km", est5k, r);
    } else if (dist > 6000) {
      // Jeśli bieg jest znacznie dłuższy, szacujemy z tempa średniego
      const est5k = pace * 5;
      checkAndSetBest("5k", "Najszybsze 5 km", est5k, r);
    }

    // Najlepszy czas na 10 km
    if (dist >= 9800 && dist <= 12000) {
      const est10k = (10000 / dist) * r.duration;
      checkAndSetBest("10k", "Najszybsze 10 km", est10k, r);
    } else if (dist > 12000) {
      const est10k = pace * 10;
      checkAndSetBest("10k", "Najszybsze 10 km", est10k, r);
    }
  }

  // Zwracamy posortowane rekordy
  const order = ["1k", "5k", "10k"];
  return order.map((key) => bests[key]).filter(Boolean);
}

/**
 * Wykrywa rekordy siłowe (1RM ze wzoru Epleya) dla głównych bojów
 */
export function calculatePersonalBestsLifts(
  strengthWorkouts: {
    id: string;
    startedAt: string | Date;
    exercises: {
      id: string;
      name: string;
      sets: { weight: number; reps: number }[];
    }[];
  }[]
): PersonalBestLift[] {
  // Nazwy głównych bojów do wyłapania (elastycznie)
  const targetLifts = [
    { key: "squat", name: "Przysiad", aliases: ["squat", "przysiad", "back squat", "goblet squat"] },
    { key: "deadlift", name: "Martwy Ciąg", aliases: ["deadlift", "martwy", "martwy ciąg", "romanian deadlift"] },
    { key: "bench", name: "Wyciskanie leżąc", aliases: ["bench press", "wyciskanie", "wyciskanie leżąc", "chest press"] },
    { key: "overhead", name: "Wyciskanie nad głowę", aliases: ["overhead press", "ohp", "wyciskanie żołnierskie", "military press"] }
  ];

  const bests: Record<string, PersonalBestLift> = {};

  for (const w of strengthWorkouts) {
    const dateStr = format(new Date(w.startedAt), "dd.MM.yyyy");

    for (const ex of w.exercises) {
      const nameLower = ex.name.toLowerCase();
      
      // Sprawdź czy to ćwiczenie pasuje do któregoś z głównych bojów
      const matched = targetLifts.find(
        (t) => t.aliases.some((alias) => nameLower.includes(alias))
      );

      if (!matched) continue;

      for (const s of ex.sets) {
        if (s.weight <= 0 || s.reps <= 0) continue;

        // Wzór Epleya: 1RM = ciężar * (1 + powtórzenia / 30)
        // Dla 1 powtórzenia 1RM = ciężar.
        const oneRepMax = s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30);

        if (!bests[matched.key] || oneRepMax > bests[matched.key].oneRepMax) {
          bests[matched.key] = {
            exerciseName: matched.name,
            oneRepMax: Math.round(oneRepMax * 10) / 10,
            weight: s.weight,
            reps: s.reps,
            date: dateStr,
            workoutId: w.id
          };
        }
      }
    }
  }

  return Object.values(bests).sort((a, b) => b.oneRepMax - a.oneRepMax);
}

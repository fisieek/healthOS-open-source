import { prisma } from "@/lib/db";
import { calculateTrainingStress } from "@/lib/services/training-analytics";
import { format, subDays } from "date-fns";

export async function buildUserContext(userId: string): Promise<string> {
  const now = new Date();

  // 1. Fetch User Profile
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  // 2. Fetch Latest Daily Metric
  const latestMetric = await prisma.dailyMetric.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // 3. Fetch Latest Sleep Session
  const latestSleep = await prisma.sleepSession.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // 4. Fetch Latest Body Measurement
  const latestBody = await prisma.bodyMeasurement.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });

  // 5. Fetch Active Supplements
  const activeSupplements = await prisma.supplement.findMany({
    where: {
      userId,
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
    include: {
      ingredients: true,
    },
  });

  // 6. Fetch Active Medications
  const activeMedications = await prisma.medication.findMany({
    where: {
      userId,
      startDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
  });

  // 7. Fetch Latest Endurance Activity
  const latestActivity = await prisma.activity.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });

  // 8. Fetch Latest Strength Workout
  const latestStrength = await prisma.strengthWorkout.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
  });

  // 9. Calculate current training load (CTL/ATL/TSB)
  let trainingLoadString = "Brak danych o obciążeniu treningowym.";
  try {
    const past130Days = subDays(now, 130);
    const activities = await prisma.activity.findMany({
      where: {
        userId,
        startedAt: { gte: past130Days },
      },
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
      where: {
        userId,
        startedAt: { gte: past130Days },
      },
      select: {
        id: true,
        startedAt: true,
        duration: true,
        volume: true,
      },
    });

    const maxHr = profile?.maxHr ?? 190;
    const stressPoints = calculateTrainingStress(
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
      1,
      maxHr
    );

    if (stressPoints.length > 0) {
      const latestPoint = stressPoints[stressPoints.length - 1];
      trainingLoadString = `Forma (CTL): ${latestPoint.ctl}, Zmęczenie (ATL): ${latestPoint.atl}, Balans (TSB): ${latestPoint.tsb}`;
    }
  } catch (error) {
    console.error("Błąd podczas obliczania obciążenia treningowego w kontekście:", error);
  }

  // Helper to format date
  const formatDate = (d?: Date | null) => d ? format(d, "dd.MM.yyyy") : "Brak danych";

  // Build the context string
  let context = `INFORMACJE O UŻYTKOWNIKU:\n`;
  if (profile) {
    const age = profile.birthDate ? Math.floor((now.getTime() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Nieznany";
    context += `- Wiek: ${age} lat\n`;
    context += `- Płeć: ${profile.sex === "M" ? "Mężczyzna" : profile.sex === "F" ? "Kobieta" : "Nieznana"}\n`;
    context += `- Wzrost: ${profile.heightCm ?? "Brak"} cm\n`;
    context += `- Max HR: ${profile.maxHr ?? "Brak"} bpm, Resting HR: ${profile.restingHr ?? "Brak"} bpm\n`;
    context += `- Lactate Threshold HR (LTHR): ${profile.lthr ?? "Brak"} bpm\n`;
    context += `- FTP (Cycling): ${profile.ftp ?? "Brak"} W\n`;
    context += `- Daniels VDOT (Running): ${profile.vdot ?? "Brak"}\n`;
  } else {
    context += `- Brak utworzonego profilu fizjologicznego.\n`;
  }

  context += `\nDZISIEJSZE / OSTATNIE METRYKI DZIENNE (z dnia ${formatDate(latestMetric?.date)}):\n`;
  if (latestMetric) {
    context += `- Kroki: ${latestMetric.steps ?? "Brak"}\n`;
    context += `- Aktywne kalorie: ${latestMetric.activeCalories ?? "Brak"} kcal, Całkowite kalorie: ${latestMetric.totalCalories ?? "Brak"} kcal\n`;
    context += `- Tętno spoczynkowe: ${latestMetric.restingHr ?? "Brak"} bpm\n`;
    context += `- Zmienność tętna (HRV): ${latestMetric.hrv ?? "Brak"} ms\n`;
    context += `- SpO2: ${latestMetric.spo2 ?? "Brak"}%\n`;
    context += `- Poziom stresu: ${latestMetric.stressScore ?? "Brak"}/100\n`;
  } else {
    context += `- Brak danych o metrykach dziennych.\n`;
  }

  context += `\nOSTATNI SEN (z dnia ${formatDate(latestSleep?.date)}):\n`;
  if (latestSleep) {
    const totalHrs = latestSleep.totalMinutes ? Math.round((latestSleep.totalMinutes / 60) * 10) / 10 : null;
    context += `- Całkowity czas: ${totalHrs ?? "Brak"} godz. (${latestSleep.totalMinutes ?? "Brak"} min.)\n`;
    context += `- Wydajność snu: ${latestSleep.efficiency ?? "Brak"}%\n`;
    context += `- Głęboki: ${latestSleep.deepMinutes ?? "Brak"} min, REM: ${latestSleep.remMinutes ?? "Brak"} min, Płytki: ${latestSleep.lightMinutes ?? "Brak"} min, Wybudzenia: ${latestSleep.awakeMinutes ?? "Brak"} min\n`;
  } else {
    context += `- Brak danych o ostatnim śnie.\n`;
  }

  context += `\nOSTATNI POMIAR CIAŁA (z dnia ${formatDate(latestBody?.date)}):\n`;
  if (latestBody) {
    context += `- Waga: ${latestBody.weight ?? "Brak"} kg\n`;
    context += `- BMI: ${latestBody.bmi ?? "Brak"}\n`;
    context += `- Procent tłuszczu (BF): ${latestBody.bodyFat ?? "Brak"}%\n`;
    context += `- Masa mięśniowa: ${latestBody.muscleMass ?? "Brak"} kg\n`;
    if (latestBody.visceralFat) context += `- Tłuszcz trzewny: indeks ${latestBody.visceralFat}\n`;
    if (latestBody.metabolicAge) context += `- Wiek metaboliczny: ${latestBody.metabolicAge} lat\n`;
  } else {
    context += `- Brak pomiarów składu ciała.\n`;
  }

  context += `\nAKTYWNE SUPLEMENTY:\n`;
  if (activeSupplements.length > 0) {
    for (const sup of activeSupplements) {
      const ingredientsList = sup.ingredients.map(ing => `${ing.name}: ${ing.amount ?? ""}${ing.unit ?? ""}`).join(", ");
      context += `- ${sup.name} (${sup.productName ?? ""})${ingredientsList ? ` [Składniki: ${ingredientsList}]` : ""}\n`;
    }
  } else {
    context += `- Brak aktywnych suplementów.\n`;
  }

  context += `\nAKTYWNE LEKI:\n`;
  if (activeMedications.length > 0) {
    for (const med of activeMedications) {
      context += `- ${med.name} (Dawka: ${med.dose ?? "Brak"}, Częstotliwość: ${med.frequency ?? "Brak"})\n`;
    }
  } else {
    context += `- Brak aktywnych leków.\n`;
  }

  context += `\nOSTATNIA AKTYWNOŚĆ WYDOLNOŚCIOWA (KARDIO):\n`;
  if (latestActivity) {
    const distanceKm = latestActivity.distance ? Math.round((latestActivity.distance / 1000) * 100) / 100 : null;
    const durationMin = Math.round(latestActivity.duration / 60);
    context += `- Data: ${formatDate(latestActivity.startedAt)}\n`;
    context += `- Typ: ${latestActivity.type}, Nazwa: ${latestActivity.name}\n`;
    context += `- Dystans: ${distanceKm ?? "Brak"} km, Czas: ${durationMin} min\n`;
    if (latestActivity.avgHr) context += `- Średnie tętno: ${latestActivity.avgHr} bpm, Max: ${latestActivity.maxHr ?? "Brak"} bpm\n`;
  } else {
    context += `- Brak zapisanych aktywności kardio.\n`;
  }

  context += `\nOSTATNI TRENING SIŁOWY:\n`;
  if (latestStrength) {
    const durationMin = latestStrength.duration ? Math.round(latestStrength.duration / 60) : null;
    context += `- Data: ${formatDate(latestStrength.startedAt)}\n`;
    context += `- Nazwa: ${latestStrength.name}\n`;
    if (durationMin) context += `- Czas trwania: ${durationMin} min\n`;
    if (latestStrength.volume) context += `- Objętość (ciężar całkowity): ${latestStrength.volume} kg\n`;
  } else {
    context += `- Brak zapisanych treningów siłowych.\n`;
  }

  context += `\nOBCIĄŻENIE TRENINGOWE (Wearable Analytics):\n`;
  context += `- ${trainingLoadString}\n`;

  return context;
}

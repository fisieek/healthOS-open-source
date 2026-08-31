import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addYears } from "date-fns";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    date,
    weight,
    bodyFat,
    muscleMass,
    waist,
    chest,
    hips,
    thigh,
    bicep,
    calf,
    shoulder,
    height,
    notes,
    // Rozszerzone pola z wagi inteligentnej (opcjonalne)
    bmi,
    leanBodyMass,
    boneMass,
    bodyWaterPct,
    proteinPct,
    visceralFat,
    basalMetabolism,
    metabolicAge,
    bodyType,
    bodyScore,
    idealWeight,
    skeletalMusclePct,
    sourceLabel,
    source,
    // Nowe pola z wagi inteligentnej (zaawansowane)
    waterMass,
    fatMass,
    proteinMass,
    musclePct,
    bonePct,
    skeletalMuscleMass,
    waistToHipRatio,
  } = body;

  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const userId = session.user.id;

  const measurement = await prisma.bodyMeasurement.create({
    data: {
      userId,
      date: new Date(date),
      weight: weight != null ? parseFloat(weight) : null,
      bodyFat: bodyFat != null ? parseFloat(bodyFat) : null,
      muscleMass: muscleMass != null ? parseFloat(muscleMass) : null,
      waist: waist != null ? parseFloat(waist) : null,
      chest: chest != null ? parseFloat(chest) : null,
      hips: hips != null ? parseFloat(hips) : null,
      thigh: thigh != null ? parseFloat(thigh) : null,
      bicep: bicep != null ? parseFloat(bicep) : null,
      calf: calf != null ? parseFloat(calf) : null,
      shoulder: shoulder != null ? parseFloat(shoulder) : null,
      height: height != null ? parseFloat(height) : null,
      bmi: bmi != null ? parseFloat(bmi) : null,
      leanBodyMass: leanBodyMass != null ? parseFloat(leanBodyMass) : null,
      boneMass: boneMass != null ? parseFloat(boneMass) : null,
      bodyWaterPct: bodyWaterPct != null ? parseFloat(bodyWaterPct) : null,
      proteinPct: proteinPct != null ? parseFloat(proteinPct) : null,
      visceralFat: visceralFat != null ? parseFloat(visceralFat) : null,
      basalMetabolism: basalMetabolism != null ? parseInt(basalMetabolism) : null,
      metabolicAge: metabolicAge != null ? parseInt(metabolicAge) : null,
      bodyType: bodyType ?? null,
      bodyScore: bodyScore != null ? parseInt(bodyScore) : null,
      idealWeight: idealWeight != null ? parseFloat(idealWeight) : null,
      skeletalMusclePct: skeletalMusclePct != null ? parseFloat(skeletalMusclePct) : null,
      waterMass: waterMass != null ? parseFloat(waterMass) : null,
      fatMass: fatMass != null ? parseFloat(fatMass) : null,
      proteinMass: proteinMass != null ? parseFloat(proteinMass) : null,
      musclePct: musclePct != null ? parseFloat(musclePct) : null,
      bonePct: bonePct != null ? parseFloat(bonePct) : null,
      skeletalMuscleMass: skeletalMuscleMass != null ? parseFloat(skeletalMuscleMass) : null,
      waistToHipRatio: waistToHipRatio != null ? parseFloat(waistToHipRatio) : null,
      sourceLabel: sourceLabel ?? null,
      source: source ?? "MANUAL",
      notes: notes
        ? `${notes}${thigh ? ` | Udo: ${thigh}cm` : ""}${bicep ? ` | Biceps: ${bicep}cm` : ""}${calf ? ` | Łydka: ${calf}cm` : ""}${shoulder ? ` | Ramię: ${shoulder}cm` : ""}`
        : [
            thigh ? `Udo: ${thigh}cm` : null,
            bicep ? `Biceps: ${bicep}cm` : null,
            calf ? `Łydka: ${calf}cm` : null,
            shoulder ? `Ramię: ${shoulder}cm` : null,
          ]
            .filter(Boolean)
            .join(" | ") || null,
    },
  });

  // ── Auto-create cyclic reminder habit for next measurement ──────────────
  // Find or create a "Pomiar ciała i obwodów" habit (YEARLY frequency) and log it as
  // completed today, so the next occurrence lands in 1 year.
  try {
    const measurementHabitName = "Pomiar ciała i obwodów";
    let habit = await prisma.habit.findFirst({
      where: { userId, name: measurementHabitName },
    });

    if (!habit) {
      habit = await prisma.habit.create({
        data: {
          userId,
          name: measurementHabitName,
          type: "BOOLEAN",
          frequency: "YEARLY",
          isActive: true,
          order: 99,
        },
      });
    } else if (habit.frequency !== "YEARLY") {
      // Jeśli nawyk istniał jako miesięczny, uaktualniamy go do rocznego
      await prisma.habit.update({
        where: { id: habit.id },
        data: { frequency: "YEARLY" },
      });
    }

    // Mark today as completed
    const today = new Date(date);
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: habit.id, date: today } },
      update: { completed: true },
      create: { habitId: habit.id, date: today, completed: true },
    });

    // Schedule next measurement as an uncompleted log for next year in the same habit
    const nextMeasurementDate = addYears(today, 1);
    await prisma.habitLog.upsert({
      where: {
        habitId_date: { habitId: habit.id, date: nextMeasurementDate },
      },
      update: {},
      create: {
        habitId: habit.id,
        date: nextMeasurementDate,
        completed: false,
        notes: `Zaplanowane po pomiarze z dnia ${date}`,
      },
    });
  } catch (err) {
    // Non-critical — don't fail the whole request
    console.error("[log/body] Failed to create cyclic reminder:", err);
  }

  return Response.json({ ok: true, id: measurement.id });
}

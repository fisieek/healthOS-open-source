import { prisma } from "@/lib/db";
import { getMuscleGroup } from "./muscle-groups";
import { ExerciseType } from "@/app/generated/prisma/client";

export interface MappedExercise {
  name: string;
  muscleGroup: string;
  type: ExerciseType;
  exerciseDefinitionId: string;
}

/**
 * Normalizuje nazwę ćwiczenia w celu porównania (małe litery, usunięcie zbędnych spacji i polskich znaków)
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // usuwanie diakrytyków
}

/**
 * Ustala typ ćwiczenia na podstawie serii wyciągniętych przez Gemini
 */
export function determineExerciseType(sets: { weight?: number | null; reps?: number | null; duration?: number | null }[]): ExerciseType {
  let hasDuration = false;
  let hasWeight = false;

  for (const s of sets) {
    if (s.duration && s.duration > 0) {
      hasDuration = true;
    }
    if (s.weight && s.weight > 0) {
      hasWeight = true;
    }
  }

  if (hasDuration) {
    return ExerciseType.DURATION;
  }
  if (!hasWeight) {
    // Brak ciężaru we wszystkich seriach -> same powtórzenia
    return ExerciseType.REPS_ONLY;
  }
  return ExerciseType.REPS_WEIGHT;
}

/**
 * Mapuje nazwę ćwiczenia na istniejący słownik lub automatycznie rejestruje nowe ćwiczenie.
 */
export async function mapOrRegisterExercise(
  userId: string,
  exerciseName: string,
  sets: { weight?: number | null; reps?: number | null; duration?: number | null }[],
  suggestedMuscleGroup?: string
): Promise<MappedExercise> {
  const normalizedInput = normalizeName(exerciseName);

  // Pobierz wszystkie ćwiczenia użytkownika oraz globalne (userId = null)
  const definitions = await prisma.exerciseDefinition.findMany({
    where: {
      OR: [
        { userId },
        { userId: null }
      ]
    }
  });

  // Szukaj dopasowania 1:1 po znormalizowanej nazwie
  let matched = definitions.find(d => normalizeName(d.name) === normalizedInput);

  if (matched) {
    return {
      name: matched.name,
      muscleGroup: matched.muscleGroup,
      type: matched.type,
      exerciseDefinitionId: matched.id
    };
  }

  // Jeśli brak dopasowania, określamy typ i partię mięśniową
  const determinedType = determineExerciseType(sets);
  const muscleGroup = suggestedMuscleGroup || getMuscleGroup(exerciseName); // dynamiczne wyliczenie z pliku muscle-groups.ts

  // Tworzymy nowe ćwiczenie w słowniku użytkownika
  const newDefinition = await prisma.exerciseDefinition.create({
    data: {
      userId,
      name: exerciseName.trim(),
      muscleGroup,
      type: determinedType
    }
  });

  return {
    name: newDefinition.name,
    muscleGroup: newDefinition.muscleGroup,
    type: newDefinition.type,
    exerciseDefinitionId: newDefinition.id
  };
}

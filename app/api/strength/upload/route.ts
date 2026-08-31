import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { extractStrengthWorkoutFromPhoto } from "@/lib/services/gemini";
import { mapOrRegisterExercise, normalizeName, determineExerciseType } from "@/lib/services/exercise-dictionary";
import { readUploadedFile, ALLOWED_IMAGE_MIME, UploadError } from "@/lib/services/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/strength/upload
 * Accepts a Gymlify/Hevy workout report image (multipart) or a JSON representation of an edited workout,
 * extracts/validates data, and saves as StrengthWorkout + exercises + sets.
 *
 * If content-type is application/json:
 *   Expects { saveMode: "save", workoutData: {...} }
 * If content-type is multipart/form-data:
 *   Expects file (image) and saveMode ("preview" | "save")
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    let workoutData: any;
    let saveMode = "preview";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      workoutData = body.workoutData;
      saveMode = body.saveMode ?? "save";
    } else {
      const form = await request.formData();
      const file = form.get("file");
      saveMode = (form.get("saveMode") as string) ?? "preview";

      if (!(file instanceof File)) {
        return Response.json({ error: "Brak pliku 'file' w żądaniu" }, { status: 400 });
      }

      const { buffer, mime: mimeType } = await readUploadedFile(file, ALLOWED_IMAGE_MIME);
      const base64 = buffer.toString("base64");

      // Extract workout data from image
      const extracted = await extractStrengthWorkoutFromPhoto(userId, base64, mimeType);

      // Map exercises to dictionary and enrich with type and muscleGroup immediately (both for preview and save)
      const enrichedExercises = await Promise.all(
        extracted.exercises.map(async (ex) => {
          const mapped = await mapOrRegisterExercise(userId, ex.name, ex.sets, ex.muscleGroup || undefined);
          return {
            ...ex,
            name: mapped.name, // use normalized dictionary name
            muscleGroup: mapped.muscleGroup,
            type: mapped.type,
            exerciseDefinitionId: mapped.exerciseDefinitionId,
          };
        })
      );

      workoutData = {
        ...extracted,
        exercises: enrichedExercises,
      };
    }

    if (saveMode !== "save") {
      // Preview mode — return extracted data for user verification
      return Response.json({ success: true, data: workoutData });
    }

    if (!workoutData) {
      return Response.json({ error: "Brak danych treningu do zapisania" }, { status: 400 });
    }

    // Save mode — persist to DB with intelligent muscleGroup dictionary mapping
    const workoutDate = workoutData.date ? new Date(workoutData.date) : new Date();
    const workoutName = workoutData.workoutName ?? `Trening ${workoutDate.toLocaleDateString("pl-PL")}`;

    // Map/Update exercise definitions in dictionary before saving
    const savedExercises = await Promise.all(
      workoutData.exercises.map(async (ex: any) => {
        const normalizedInput = normalizeName(ex.name);
        const definitions = await prisma.exerciseDefinition.findMany({
          where: {
            OR: [
              { userId },
              { userId: null }
            ]
          }
        });

        const matched = definitions.find(d => normalizeName(d.name) === normalizedInput);
        let targetDefinitionId = ex.exerciseDefinitionId;

        if (matched) {
          if (matched.muscleGroup === ex.muscleGroup) {
            targetDefinitionId = matched.id;
          } else {
            // Grupa mięśniowa się zmieniła!
            if (matched.userId === userId) {
              // Prywatna definicja użytkownika — możemy zaktualizować partię bezpośrednio
              const updated = await prisma.exerciseDefinition.update({
                where: { id: matched.id },
                data: { muscleGroup: ex.muscleGroup }
              });
              targetDefinitionId = updated.id;
            } else {
              // Globalna definicja — tworzymy prywatną kopię o nowej grupie dla tego użytkownika
              const created = await prisma.exerciseDefinition.create({
                data: {
                  userId,
                  name: matched.name,
                  muscleGroup: ex.muscleGroup,
                  type: matched.type
                }
              });
              targetDefinitionId = created.id;
            }
          }
        } else {
          // Nowe ćwiczenie, którego nie ma w bazie — tworzymy definicję
          const determinedType = determineExerciseType(ex.sets);
          const created = await prisma.exerciseDefinition.create({
            data: {
              userId,
              name: ex.name.trim(),
              muscleGroup: ex.muscleGroup,
              type: determinedType
            }
          });
          targetDefinitionId = created.id;
        }

        return {
          name: ex.name,
          order: ex.order,
          exerciseDefinitionId: targetDefinitionId,
          type: ex.type,
          sets: ex.sets
        };
      })
    );

    // Calculate total volume (only for weight-based exercises)
    let totalVolume = 0;
    for (const ex of savedExercises) {
      if (ex.type === "REPS_WEIGHT") {
        for (const s of ex.sets) {
          totalVolume += (s.weight ?? 0) * (s.reps ?? 0);
        }
      }
    }

    const workout = await prisma.strengthWorkout.create({
      data: {
        userId,
        name: workoutName,
        startedAt: workoutDate,
        duration: workoutData.durationSec || workoutData.duration,
        volume: totalVolume > 0 ? totalVolume : null,
        notes: workoutData.notes,
        exercises: {
          create: savedExercises.map((ex) => ({
            name: ex.name,
            order: ex.order,
            exerciseDefinitionId: ex.exerciseDefinitionId,
            sets: {
              create: ex.sets.map((s: any) => ({
                setNumber: s.setNumber,
                weight: s.weight,
                reps: s.reps,
                duration: s.duration,
                rpe: s.rpe,
                notes: s.notes,
                isPr: false,
              })),
            },
          })),
        },
      },
    });

    return Response.json({ success: true, workoutId: workout.id, data: workoutData });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Błąd AI Upload Strength:", error);
    const isAiError = error.message?.includes("non-JSON") || error.message?.includes("Gemini");
    return Response.json(
      { error: isAiError
          ? "Nie udało się odczytać danych treningu ze zdjęcia. Spróbuj ponownie lub użyj lepszej jakości zdjęcia."
          : (error.message || "Wystąpił błąd podczas analizy lub zapisu treningu przez AI") },
      { status: 500 }
    );
  }
}

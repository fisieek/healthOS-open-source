import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mapOrRegisterExercise, normalizeName, determineExerciseType } from "@/lib/services/exercise-dictionary";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const { exerciseName, muscleGroup } = await request.json();

    if (!exerciseName || !muscleGroup) {
      return Response.json({ error: "Brak nazwy ćwiczenia lub grupy mięśniowej" }, { status: 400 });
    }

    const normalizedInput = normalizeName(exerciseName);

    // Pobierz wszystkie definicje (użytkownika i globalne)
    const definitions = await prisma.exerciseDefinition.findMany({
      where: {
        OR: [
          { userId },
          { userId: null }
        ]
      }
    });

    const matched = definitions.find(d => normalizeName(d.name) === normalizedInput);
    let targetDefinitionId: string;

    if (matched) {
      if (matched.userId === userId) {
        // Prywatna definicja użytkownika — aktualizujemy bezpośrednio
        const updated = await prisma.exerciseDefinition.update({
          where: { id: matched.id },
          data: { muscleGroup }
        });
        targetDefinitionId = updated.id;
      } else {
        // Globalna definicja — tworzymy prywatną kopię o nowej grupie
        const created = await prisma.exerciseDefinition.create({
          data: {
            userId,
            name: matched.name,
            muscleGroup,
            type: matched.type
          }
        });
        targetDefinitionId = created.id;
      }
    } else {
      // Brak dopasowania — szukamy czy użytkownik ma jakieś ćwiczenia o tej nazwie, żeby ustalić typ
      const existingEx = await prisma.strengthExercise.findFirst({
        where: {
          workout: { userId },
          name: { equals: exerciseName }
        },
        include: { sets: true }
      });

      const determinedType = existingEx ? determineExerciseType(existingEx.sets) : "REPS_WEIGHT";

      const created = await prisma.exerciseDefinition.create({
        data: {
          userId,
          name: exerciseName.trim(),
          muscleGroup,
          type: determinedType
        }
      });
      targetDefinitionId = created.id;
    }

    // Pobierz wszystkie dotychczasowe ćwiczenia użytkownika o znormalizowanej nazwie
    const userExercises = await prisma.strengthExercise.findMany({
      where: {
        workout: { userId }
      },
      select: { id: true, name: true }
    });

    const exerciseIdsToLink = userExercises
      .filter(ex => normalizeName(ex.name) === normalizedInput)
      .map(ex => ex.id);

    if (exerciseIdsToLink.length > 0) {
      await prisma.strengthExercise.updateMany({
        where: {
          id: { in: exerciseIdsToLink }
        },
        data: {
          exerciseDefinitionId: targetDefinitionId
        }
      });
    }

    return Response.json({ success: true, exerciseDefinitionId: targetDefinitionId });
  } catch (error: any) {
    console.error("Błąd podczas przypisywania grupy mięśniowej:", error);
    return Response.json({ error: error.message || "Wystąpił błąd serwera" }, { status: 500 });
  }
}

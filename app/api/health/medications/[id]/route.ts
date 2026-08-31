import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";

export const runtime = "nodejs";

/**
 * PATCH /api/health/medications/[id]
 *
 * Edycja leku. Do tej pory model był jedynym medycznym bez edycji — zmiana dawki
 * wymagała skasowania wpisu i dodania nowego, czyli utraty historii.
 *
 * Wzorzec jak w `api/health/visits/[id]`: auth → 401, ownership → 404,
 * pola aktualizowane wyłącznie gdy `!== undefined` (pominięte pole = bez zmian,
 * jawny `null` = wyczyszczenie).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const medication = await prisma.medication.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!medication || medication.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, dose, frequency, startDate, endDate, notes, episodeId } = body;

  if (name !== undefined && !String(name).trim()) {
    return Response.json({ error: "name nie może być puste" }, { status: 400 });
  }

  const episodeLink = await resolveEpisodeLink(session.user.id, episodeId);

  const updated = await prisma.medication.update({
    where: { id },
    data: {
      ...(episodeLink !== undefined && { episodeId: episodeLink.episodeId }),
      name: name !== undefined ? String(name).trim() : undefined,
      dose: dose !== undefined ? (dose ? String(dose).trim() : null) : undefined,
      frequency:
        frequency !== undefined
          ? frequency
            ? String(frequency).trim()
            : null
          : undefined,
      // `startDate` jest wymagany w schemacie — pusta wartość byłaby błędem,
      // więc pomijamy zamiast zapisywać null.
      startDate: startDate ? new Date(startDate) : undefined,
      endDate:
        endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
      notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined,
    },
  });

  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const medication = await prisma.medication.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!medication || medication.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.medication.delete({ where: { id } });
  return Response.json({ ok: true });
}

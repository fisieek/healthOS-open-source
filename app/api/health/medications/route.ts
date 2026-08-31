import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const medications = await prisma.medication.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  });

  return Response.json(medications);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, dose, frequency, startDate, endDate, notes, episodeId } = body;

  if (!name || !startDate) {
    return Response.json({ error: "name and startDate are required" }, { status: 400 });
  }

  // Cudzy lub nieistniejący epizod traktujemy jak brak powiązania.
  const episodeLink = await resolveEpisodeLink(session.user.id, episodeId);

  const medication = await prisma.medication.create({
    data: {
      userId: session.user.id,
      episodeId: episodeLink?.episodeId ?? null,
      name: name.trim(),
      dose: dose || null,
      frequency: frequency || null,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || null,
    },
  });

  return Response.json(medication, { status: 201 });
}

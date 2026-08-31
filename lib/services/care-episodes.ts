import { prisma } from "@/lib/db";

/**
 * Epizody leczenia (CareEpisode).
 *
 * BodyPart zostaje słownikiem anatomicznym („Kolano lewe" istnieje raz per user),
 * a epizod to jeden zamykalny wątek leczenia tej części ciała. Dzięki temu
 * „Uraz łąkotki 2026" i „Ból kolana 2031" nie mieszają się w jednej historii.
 */

export type EpisodeStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

const STATUSES: EpisodeStatus[] = ["ACTIVE", "MONITORING", "RESOLVED"];

export function isEpisodeStatus(v: unknown): v is EpisodeStatus {
  return typeof v === "string" && (STATUSES as string[]).includes(v);
}

const EPISODE_SELECT = {
  id: true,
  bodyPartId: true,
  title: true,
  status: true,
  startDate: true,
  endDate: true,
  outcome: true,
  notes: true,
  bodyPart: { select: { id: true, name: true } },
} as const;

export async function listEpisodes(userId: string, bodyPartId?: string | null) {
  return prisma.careEpisode.findMany({
    where: { userId, ...(bodyPartId ? { bodyPartId } : {}) },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: {
      ...EPISODE_SELECT,
      _count: { select: { visits: true, documents: true } },
    },
  });
}

export async function ownsEpisode(userId: string, id: string): Promise<boolean> {
  const found = await prisma.careEpisode.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  return !!found;
}

export async function createEpisode(
  userId: string,
  data: {
    bodyPartId: string;
    title: string;
    status?: EpisodeStatus;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    outcome?: string | null;
    notes?: string | null;
  }
) {
  return prisma.careEpisode.create({
    data: {
      userId,
      bodyPartId: data.bodyPartId,
      title: data.title.trim(),
      status: data.status ?? "ACTIVE",
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      outcome: data.outcome?.trim() || null,
      notes: data.notes?.trim() || null,
    },
    select: EPISODE_SELECT,
  });
}

export async function updateEpisode(
  id: string,
  data: {
    title?: string;
    status?: EpisodeStatus;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    outcome?: string | null;
    notes?: string | null;
  }
) {
  // Zamknięcie leczenia bez podanej daty → domyślnie dziś.
  // Ponowne otwarcie (ACTIVE/MONITORING) czyści datę zakończenia.
  const closing = data.status === "RESOLVED";
  const reopening = data.status === "ACTIVE" || data.status === "MONITORING";

  return prisma.careEpisode.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.startDate !== undefined && data.startDate
        ? { startDate: new Date(data.startDate) }
        : {}),
      ...(data.endDate !== undefined
        ? { endDate: data.endDate ? new Date(data.endDate) : null }
        : closing
        ? { endDate: new Date() }
        : {}),
      ...(reopening && data.endDate === undefined ? { endDate: null } : {}),
      ...(data.outcome !== undefined && { outcome: data.outcome?.trim() || null }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
    },
    select: EPISODE_SELECT,
  });
}

/** Usuwa epizod. FK na wizytach i badaniach są SET NULL — rekordy NIE znikają. */
export async function deleteEpisode(id: string): Promise<void> {
  await prisma.careEpisode.delete({ where: { id } });
}

/**
 * Rozwiązuje `episodeId` przy zapisie wizyty/badania i pilnuje niezmiennika:
 * epizod zawsze pociąga za sobą swoją część ciała.
 *
 * Zwraca `undefined`, gdy pole nie było w ogóle przekazane (PATCH częściowy).
 */
export async function resolveEpisodeLink(
  userId: string,
  episodeId: string | null | undefined
): Promise<{ episodeId: string | null; bodyPartId?: string } | undefined> {
  if (episodeId === undefined) return undefined;
  if (!episodeId) return { episodeId: null };

  const episode = await prisma.careEpisode.findFirst({
    where: { id: episodeId, userId },
    select: { id: true, bodyPartId: true },
  });
  // Cudzy lub nieistniejący epizod traktujemy jak brak powiązania.
  if (!episode) return { episodeId: null };
  return { episodeId: episode.id, bodyPartId: episode.bodyPartId };
}

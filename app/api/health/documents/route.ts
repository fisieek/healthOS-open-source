import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  resolveDoctorId,
  resolveFacilityId,
  resolveBodyPartId,
} from "@/lib/services/medical-dictionaries";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.healthDocument.findMany({
    where: { userId: session.user.id },
    orderBy: { studyDate: "desc" },
    include: {
      bodyPart: { select: { id: true, name: true } },
      orderingDoctor: { select: { id: true, name: true, specialization: true } },
      performingDoctor: { select: { id: true, name: true, specialization: true } },
      facilityRef: { select: { id: true, name: true } },
      visit: { select: { id: true, date: true, doctorName: true } },
      episode: { select: { id: true, title: true, status: true } },
    },
  });

  return Response.json(documents);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    type,
    studyDate,
    laboratory,
    doctor,
    description,
    tags,
    fileUrl,
    parameters,
    // nowe pola
    status,
    plannedDate,
    bodyPart, // nazwa
    bodyPartId, // lub id
    visitId,
    orderingDoctor, // nazwa
    orderingDoctorId,
    orderingSpecialization, // specjalizacja lekarza zlecającego
    performingDoctor, // nazwa
    performingDoctorId,
    facility, // nazwa placówki wykonującej
    facilityId,
    episodeId, // epizod leczenia (pociąga za sobą swoją część ciała)
  } = body;

  if (!title || !type) {
    return Response.json(
      { error: "title and type are required" },
      { status: 400 }
    );
  }

  const isPlanned = status === "PLANNED";
  // studyDate: DONE = faktyczna data; PLANNED = planowany termin (albo dziś).
  const effectiveStudyDate = studyDate
    ? new Date(studyDate)
    : plannedDate
    ? new Date(plannedDate)
    : new Date();

  if (!isPlanned && !studyDate) {
    return Response.json(
      { error: "studyDate is required for completed exams" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Słowniki: nazwy → FK (id ma pierwszeństwo, jeśli podane).
  const [resolvedBodyPart, resolvedOrdering, resolvedPerforming, resolvedFacility] =
    await Promise.all([
      bodyPartId ?? resolveBodyPartId(userId, bodyPart),
      orderingDoctorId ?? resolveDoctorId(userId, orderingDoctor, orderingSpecialization),
      performingDoctorId ?? resolveDoctorId(userId, performingDoctor ?? doctor),
      facilityId ?? resolveFacilityId(userId, facility ?? laboratory),
    ]);

  // Niezmiennik: epizod zawsze pociąga za sobą swoją część ciała.
  const episodeLink = await resolveEpisodeLink(userId, episodeId);
  const finalBodyPartId =
    episodeLink?.bodyPartId ?? resolvedBodyPart ?? null;

  const document = await prisma.healthDocument.create({
    data: {
      userId,
      title: title.trim(),
      type: type.trim(),
      studyDate: effectiveStudyDate,
      // stare kolumny tekstowe (backup / kompatybilność wstecz)
      laboratory: (laboratory ?? facility)?.trim() || null,
      doctor: (doctor ?? performingDoctor)?.trim() || null,
      description: description?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
      fileUrl: fileUrl?.trim() || null,
      parameters: parameters || null,
      // nowe
      status: isPlanned ? "PLANNED" : "DONE",
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      bodyPartId: finalBodyPartId || null,
      episodeId: episodeLink?.episodeId ?? null,
      visitId: visitId || null,
      orderingDoctorId: resolvedOrdering || null,
      performingDoctorId: resolvedPerforming || null,
      facilityId: resolvedFacility || null,
    },
    include: {
      bodyPart: { select: { id: true, name: true } },
      orderingDoctor: { select: { id: true, name: true, specialization: true } },
      performingDoctor: { select: { id: true, name: true, specialization: true } },
      facilityRef: { select: { id: true, name: true } },
      visit: { select: { id: true, date: true, doctorName: true } },
      episode: { select: { id: true, title: true, status: true } },
    },
  });

  return Response.json(document, { status: 201 });
}

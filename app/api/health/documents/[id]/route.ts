import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  resolveDoctorId,
  resolveFacilityId,
  resolveBodyPartId,
} from "@/lib/services/medical-dictionaries";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.healthDocument.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
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
    bodyPart,
    bodyPartId,
    visitId,
    orderingDoctor,
    orderingDoctorId,
    orderingSpecialization,
    performingDoctor,
    performingDoctorId,
    facility,
    facilityId,
    episodeId,
    // Kontrola zalecona w opisie badania + pamięć decyzji o sugestiach AI (poz. 5).
    followUpDate,
    followUpNote,
    aiSuggestions,
  } = body;

  const userId = session.user.id;

  // Resolve słowników tylko gdy odpowiednie pole zostało przekazane.
  const resolvedBodyPartId =
    bodyPartId !== undefined
      ? bodyPartId || null
      : bodyPart !== undefined
      ? await resolveBodyPartId(userId, bodyPart)
      : undefined;
  const resolvedOrderingId =
    orderingDoctorId !== undefined
      ? orderingDoctorId || null
      : orderingDoctor !== undefined
      ? await resolveDoctorId(userId, orderingDoctor, orderingSpecialization)
      : undefined;
  const resolvedPerformingId =
    performingDoctorId !== undefined
      ? performingDoctorId || null
      : performingDoctor !== undefined
      ? await resolveDoctorId(userId, performingDoctor)
      : doctor !== undefined
      ? await resolveDoctorId(userId, doctor)
      : undefined;
  const resolvedFacilityId =
    facilityId !== undefined
      ? facilityId || null
      : facility !== undefined
      ? await resolveFacilityId(userId, facility)
      : laboratory !== undefined
      ? await resolveFacilityId(userId, laboratory)
      : undefined;

  // Niezmiennik: epizod pociąga za sobą swoją część ciała; wyczyszczenie części
  // ciała zrywa też powiązanie z epizodem (epizod bez części ciała nie istnieje).
  const episodeLink = await resolveEpisodeLink(userId, episodeId);
  const clearingBodyPart =
    resolvedBodyPartId !== undefined && resolvedBodyPartId === null;
  const effectiveBodyPartId = episodeLink?.bodyPartId ?? resolvedBodyPartId;
  const effectiveEpisodeId = clearingBodyPart
    ? null
    : episodeLink?.episodeId;

  const document = await prisma.healthDocument.update({
    where: { id },
    data: {
      ...(title && { title: title.trim() }),
      ...(type && { type: type.trim() }),
      ...(studyDate && { studyDate: new Date(studyDate) }),
      ...(laboratory !== undefined && {
        laboratory: laboratory?.trim() || null,
      }),
      ...(doctor !== undefined && { doctor: doctor?.trim() || null }),
      ...(description !== undefined && {
        description: description?.trim() || null,
      }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
      ...(fileUrl !== undefined && { fileUrl: fileUrl?.trim() || null }),
      ...(parameters !== undefined && { parameters: parameters || null }),
      ...(status !== undefined && { status: status === "PLANNED" ? "PLANNED" : "DONE" }),
      ...(plannedDate !== undefined && {
        plannedDate: plannedDate ? new Date(plannedDate) : null,
      }),
      ...(effectiveBodyPartId !== undefined && { bodyPartId: effectiveBodyPartId }),
      ...(effectiveEpisodeId !== undefined && { episodeId: effectiveEpisodeId }),
      ...(visitId !== undefined && { visitId: visitId || null }),
      ...(resolvedOrderingId !== undefined && { orderingDoctorId: resolvedOrderingId }),
      ...(resolvedPerformingId !== undefined && { performingDoctorId: resolvedPerformingId }),
      ...(resolvedFacilityId !== undefined && { facilityId: resolvedFacilityId }),
      ...(followUpDate !== undefined && {
        followUpDate: followUpDate ? new Date(followUpDate) : null,
      }),
      ...(followUpNote !== undefined && {
        followUpNote: followUpNote?.trim() || null,
      }),
      ...(aiSuggestions !== undefined && { aiSuggestions: aiSuggestions ?? null }),
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

  return Response.json(document);
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

  const existing = await prisma.healthDocument.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.healthDocument.delete({ where: { id } });
  return Response.json({ ok: true });
}

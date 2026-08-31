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
  const body = await request.json();

  const visit = await prisma.medicalVisit.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!visit || visit.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const {
    date,
    status,
    doctorName,
    specialization,
    facility,
    reason,
    bodyPartId: bodyPartIdInput,
    episodeId,
    summary,
    recommendations,
    followUpDate,
    followUpNote,
    documentIds,
    medicationIds,
  } = body;

  const VISIT_STATUSES = ["PLANNED", "DONE", "CANCELLED"];
  const visitStatus =
    status !== undefined && VISIT_STATUSES.includes(status) ? status : undefined;

  // Data + planowany termin (jak w POST): `date` (NOT NULL) trzyma faktyczny
  // termin lub placeholder-dziś dla zaplanowanej bez daty; `plannedDate`
  // (nullable) to prawdziwy planowany termin, NULL = „nieustalony".
  const dateUpdate =
    date !== undefined ? (date ? new Date(date) : new Date()) : undefined;
  const plannedDateUpdate =
    date !== undefined && visitStatus !== undefined
      ? visitStatus === "DONE"
        ? null
        : date
        ? new Date(date)
        : null
      : undefined;

  const userId = session.user.id;

  // Gdy zmienia się nazwa lekarza/placówki/powodu — przelicz FK słownika.
  const doctorId =
    doctorName !== undefined || specialization !== undefined
      ? await resolveDoctorId(userId, doctorName, specialization)
      : undefined;
  const facilityId =
    facility !== undefined ? await resolveFacilityId(userId, facility) : undefined;
  // Część ciała: jawne `bodyPartId` (przypisanie istniejącej wizyty) ma pierwszeństwo
  // nad nazwą z pola „Powód/Część ciała" wpisaną w formularzu.
  const bodyPartId =
    bodyPartIdInput !== undefined
      ? bodyPartIdInput || null
      : reason !== undefined
      ? await resolveBodyPartId(userId, reason)
      : undefined;

  // Niezmiennik: epizod pociąga za sobą swoją część ciała.
  const episodeLink = await resolveEpisodeLink(userId, episodeId);
  const effectiveBodyPartId = episodeLink?.bodyPartId ?? bodyPartId;

  const updated = await prisma.medicalVisit.update({
    where: { id },
    data: {
      date: dateUpdate,
      plannedDate: plannedDateUpdate,
      status: visitStatus,
      doctorName: doctorName !== undefined ? doctorName.trim() : undefined,
      specialization: specialization !== undefined ? specialization.trim() : undefined,
      facility: facility !== undefined ? (facility ? facility.trim() : null) : undefined,
      reason: reason !== undefined ? reason.trim() : undefined,
      summary: summary !== undefined ? (summary ? summary.trim() : null) : undefined,
      recommendations: recommendations !== undefined ? (recommendations ? recommendations.trim() : null) : undefined,
      followUpDate: followUpDate !== undefined ? (followUpDate ? new Date(followUpDate) : null) : undefined,
      followUpNote: followUpNote !== undefined ? (followUpNote ? followUpNote.trim() : null) : undefined,
      documentIds: Array.isArray(documentIds) ? documentIds : undefined,
      medicationIds: Array.isArray(medicationIds) ? medicationIds : undefined,
      doctorId,
      facilityId,
      bodyPartId: effectiveBodyPartId,
      ...(episodeLink !== undefined && { episodeId: episodeLink.episodeId }),
    },
    include: {
      doctorRef: { select: { id: true, name: true, specialization: true } },
      facilityRef: { select: { id: true, name: true } },
      bodyPart: { select: { id: true, name: true } },
      episode: { select: { id: true, title: true, status: true } },
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

  const visit = await prisma.medicalVisit.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!visit || visit.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.medicalVisit.delete({ where: { id } });
  return Response.json({ ok: true });
}

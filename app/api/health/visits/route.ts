import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  resolveDoctorId,
  resolveFacilityId,
  resolveBodyPartId,
} from "@/lib/services/medical-dictionaries";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";
import { sortVisitsDesc } from "@/lib/services/visit-dates";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visits = await prisma.medicalVisit.findMany({
    where: { userId: session.user.id },
    include: {
      doctorRef: { select: { id: true, name: true, specialization: true } },
      facilityRef: { select: { id: true, name: true } },
      bodyPart: { select: { id: true, name: true } },
    },
  });

  // Sortowanie po faktycznym terminie, nie po kolumnie `date` — dla wizyty bez
  // ustalonego terminu `date` jest tylko placeholderem (patrz `visit-dates.ts`).
  return Response.json(sortVisitsDesc(visits));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    date,
    status,
    doctorName,
    specialization,
    facility,
    reason,
    episodeId,
    summary,
    recommendations,
    followUpDate,
    followUpNote,
    documentIds,
    medicationIds,
  } = body;

  const VISIT_STATUSES = ["PLANNED", "DONE", "CANCELLED"];
  const visitStatus = VISIT_STATUSES.includes(status) ? status : "DONE";

  // Data jest obowiązkowa tylko dla WYKONANEJ wizyty. Zaplanowana/anulowana może
  // nie mieć jeszcze ustalonego terminu.
  if (!doctorName || !specialization || !reason) {
    return Response.json(
      { error: "doctorName, specialization, and reason are required" },
      { status: 400 }
    );
  }
  if (visitStatus === "DONE" && !date) {
    return Response.json(
      { error: "date is required for a completed visit" },
      { status: 400 }
    );
  }

  // `date` (NOT NULL) = faktyczny termin lub — dla zaplanowanej bez daty —
  // placeholder (dziś) używany tylko jako klucz sortowania. `plannedDate`
  // (nullable) to prawdziwy planowany termin; NULL = „nieustalony".
  const effectiveDate = date ? new Date(date) : new Date();
  const plannedDate =
    visitStatus === "DONE" ? null : date ? new Date(date) : null;

  const userId = session.user.id;

  // Słowniki: nazwy → FK (auto-tworzenie wpisu, jeśli nowa nazwa).
  // reason = „Powód/Część ciała" → BodyPart (oś grupowania).
  const [doctorId, facilityId, bodyPartId] = await Promise.all([
    resolveDoctorId(userId, doctorName, specialization),
    resolveFacilityId(userId, facility),
    resolveBodyPartId(userId, reason),
  ]);

  // Niezmiennik: epizod pociąga za sobą swoją część ciała.
  const episodeLink = await resolveEpisodeLink(userId, episodeId);

  const visit = await prisma.medicalVisit.create({
    data: {
      userId,
      date: effectiveDate,
      plannedDate,
      status: visitStatus,
      doctorName: doctorName.trim(),
      specialization: specialization.trim(),
      facility: facility ? facility.trim() : null,
      reason: reason.trim(),
      summary: summary ? summary.trim() : null,
      recommendations: recommendations ? recommendations.trim() : null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      followUpNote: followUpNote ? followUpNote.trim() : null,
      documentIds: Array.isArray(documentIds) ? documentIds : [],
      medicationIds: Array.isArray(medicationIds) ? medicationIds : [],
      doctorId,
      facilityId,
      bodyPartId: episodeLink?.bodyPartId ?? bodyPartId,
      episodeId: episodeLink?.episodeId ?? null,
    },
    include: {
      doctorRef: { select: { id: true, name: true, specialization: true } },
      facilityRef: { select: { id: true, name: true } },
      bodyPart: { select: { id: true, name: true } },
    },
  });

  return Response.json(visit, { status: 201 });
}

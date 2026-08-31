import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  procedureNeedsTooth,
  isValidFdiTooth,
  FDI_TOOTH_ERROR,
} from "@/lib/constants/dental";
import {
  resolveDoctorId,
  resolveFacilityId,
} from "@/lib/services/medical-dictionaries";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";

export const runtime = "nodejs";

/** Relacje dołączane do każdego zwracanego zabiegu — te same, co przy wizytach. */
const DENTAL_INCLUDE = {
  dentistRef: { select: { id: true, name: true, specialization: true } },
  facilityRef: { select: { id: true, name: true } },
  episode: { select: { id: true, title: true, status: true, bodyPartId: true } },
} as const;

const DENTAL_STATUSES = ["PLANNED", "DONE"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await prisma.dentalRecord.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
    include: DENTAL_INCLUDE,
  });

  return Response.json(records);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    toothNumber,
    procedure,
    date,
    plannedDate,
    status,
    dentist,
    dentistId,
    facility,
    facilityId,
    episodeId,
    notes,
    imageUrls,
  } = body;

  const recordStatus = DENTAL_STATUSES.includes(status) ? status : "DONE";
  const needsTooth = procedureNeedsTooth(procedure);

  if (!procedure) {
    return Response.json({ error: "procedure jest wymagane" }, { status: 400 });
  }
  // Data jest obowiązkowa tylko dla wykonanego zabiegu — umówiony może nie mieć
  // jeszcze ustalonego terminu (analogicznie do wizyt i badań).
  if (recordStatus === "DONE" && !date) {
    return Response.json(
      { error: "date jest wymagane dla wykonanego zabiegu" },
      { status: 400 }
    );
  }

  if (needsTooth && (toothNumber === undefined || toothNumber === null)) {
    return Response.json(
      { error: "Ten zabieg wymaga wskazania zęba." },
      { status: 400 }
    );
  }

  let toothInt: number | null = null;
  if (needsTooth) {
    toothInt = parseInt(toothNumber, 10);
    if (!isValidFdiTooth(toothInt)) {
      return Response.json({ error: FDI_TOOTH_ERROR }, { status: 400 });
    }
  }

  const userId = session.user.id;

  // Słowniki: nazwy → FK (auto-tworzenie wpisu, jeśli nowa nazwa) — dokładnie
  // ten sam mechanizm, co przy wizytach i badaniach. `dentistId`/`facilityId`
  // mają pierwszeństwo nad wolnym tekstem.
  const [resolvedDentistId, resolvedFacilityId] = await Promise.all([
    dentistId !== undefined
      ? Promise.resolve(dentistId || null)
      : resolveDoctorId(userId, dentist, "Stomatolog"),
    facilityId !== undefined
      ? Promise.resolve(facilityId || null)
      : resolveFacilityId(userId, facility),
  ]);

  const episodeLink = await resolveEpisodeLink(userId, episodeId);

  // `date` jest NOT NULL — dla zabiegu bez terminu trzymamy placeholder,
  // a prawdziwy termin siedzi w `plannedDate` (jak w MedicalVisit).
  const effectiveDate = date ? new Date(date) : new Date();
  const effectivePlanned =
    recordStatus === "DONE"
      ? null
      : plannedDate
      ? new Date(plannedDate)
      : date
      ? new Date(date)
      : null;

  const record = await prisma.dentalRecord.create({
    data: {
      userId,
      toothNumber: toothInt,
      procedure: procedure.trim(),
      date: effectiveDate,
      plannedDate: effectivePlanned,
      status: recordStatus,
      // Stare kolumny tekstowe zostają jako backup — tak samo jak przy wizytach.
      dentist: dentist ? dentist.trim() : null,
      facility: facility ? facility.trim() : null,
      dentistId: resolvedDentistId,
      facilityId: resolvedFacilityId,
      episodeId: episodeLink?.episodeId ?? null,
      notes: notes ? notes.trim() : null,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    },
    include: DENTAL_INCLUDE,
  });

  return Response.json(record, { status: 201 });
}

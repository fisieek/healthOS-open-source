import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isValidFdiTooth, FDI_TOOTH_ERROR } from "@/lib/constants/dental";
import {
  resolveDoctorId,
  resolveFacilityId,
} from "@/lib/services/medical-dictionaries";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";

export const runtime = "nodejs";

const DENTAL_INCLUDE = {
  dentistRef: { select: { id: true, name: true, specialization: true } },
  facilityRef: { select: { id: true, name: true } },
  episode: { select: { id: true, title: true, status: true, bodyPartId: true } },
} as const;

const DENTAL_STATUSES = ["PLANNED", "DONE"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const record = await prisma.dentalRecord.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!record || record.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
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

  let toothInt: number | undefined;
  if (toothNumber !== undefined) {
    toothInt = parseInt(toothNumber, 10);
    // Ten sam warunek co w POST — rozjazd 1–48 vs 1–32 uniemożliwiał edycję
    // zębów z dolnej prawej ćwiartki (41–48).
    if (!isValidFdiTooth(toothInt)) {
      return Response.json({ error: FDI_TOOTH_ERROR }, { status: 400 });
    }
  }

  const recordStatus =
    status !== undefined && DENTAL_STATUSES.includes(status) ? status : undefined;

  const userId = session.user.id;

  const resolvedDentistId =
    dentistId !== undefined
      ? dentistId || null
      : dentist !== undefined
      ? await resolveDoctorId(userId, dentist, "Stomatolog")
      : undefined;
  const resolvedFacilityId =
    facilityId !== undefined
      ? facilityId || null
      : facility !== undefined
      ? await resolveFacilityId(userId, facility)
      : undefined;

  const episodeLink = await resolveEpisodeLink(userId, episodeId);

  // Terminy jak w POST: `date` trzyma faktyczny termin albo placeholder,
  // `plannedDate` prawdziwy planowany (null = nieustalony).
  const dateUpdate =
    date !== undefined ? (date ? new Date(date) : new Date()) : undefined;
  const plannedUpdate =
    plannedDate !== undefined
      ? plannedDate
        ? new Date(plannedDate)
        : null
      : recordStatus === "DONE"
      ? null
      : date !== undefined && recordStatus !== undefined
      ? date
        ? new Date(date)
        : null
      : undefined;

  const updated = await prisma.dentalRecord.update({
    where: { id },
    data: {
      toothNumber: toothInt !== undefined ? toothInt : undefined,
      procedure: procedure !== undefined ? procedure.trim() : undefined,
      date: dateUpdate,
      plannedDate: plannedUpdate,
      status: recordStatus,
      dentist: dentist !== undefined ? (dentist ? dentist.trim() : null) : undefined,
      facility: facility !== undefined ? (facility ? facility.trim() : null) : undefined,
      dentistId: resolvedDentistId,
      facilityId: resolvedFacilityId,
      ...(episodeLink !== undefined && { episodeId: episodeLink.episodeId }),
      notes: notes !== undefined ? (notes ? notes.trim() : null) : undefined,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : undefined,
    },
    include: DENTAL_INCLUDE,
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

  const record = await prisma.dentalRecord.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!record || record.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.dentalRecord.delete({ where: { id } });
  return Response.json({ ok: true });
}

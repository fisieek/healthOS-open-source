import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";
import { isReferralStatus } from "@/lib/services/referrals";

export const runtime = "nodejs";

const REFERRAL_INCLUDE = {
  bodyPart: { select: { id: true, name: true } },
  episode: { select: { id: true, title: true, status: true } },
  fulfilledByVisit: { select: { id: true, doctorName: true, date: true, plannedDate: true, status: true } },
  fulfilledByDocument: { select: { id: true, title: true, studyDate: true, status: true } },
} as const;

async function ensureOwnership(id: string, userId: string): Promise<boolean> {
  const ref = await prisma.referral.findUnique({
    where: { id },
    select: { userId: true },
  });
  return !!ref && ref.userId === userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await ensureOwnership(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      title, specialization, doctorName, issueDate, expiryDate, code, notes, isUsed,
      status, episodeId, bodyPartId, fulfilledByVisitId, fulfilledByDocumentId,
    } = body;

    const data: Record<string, any> = {};
    if (title !== undefined) data.title = title.trim();
    if (specialization !== undefined) data.specialization = specialization.trim();
    if (doctorName !== undefined) data.doctorName = doctorName?.trim() || null;
    if (issueDate !== undefined) data.issueDate = new Date(issueDate);
    if (expiryDate !== undefined) data.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (code !== undefined) data.code = code?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (isUsed !== undefined) data.isUsed = !!isUsed;

    // `status` jest źródłem prawdy; `isUsed` dopisujemy równolegle dla zgodności
    // ze starymi odczytami. Nigdy odwrotnie.
    if (status !== undefined && isReferralStatus(status)) {
      data.status = status;
      data.isUsed = status === "FULFILLED";
    }

    const episodeLink = await resolveEpisodeLink(session.user.id, episodeId);
    if (episodeLink !== undefined) {
      data.episodeId = episodeLink.episodeId;
      if (episodeLink.bodyPartId) data.bodyPartId = episodeLink.bodyPartId;
    }
    if (bodyPartId !== undefined && episodeLink?.bodyPartId === undefined) {
      data.bodyPartId = bodyPartId || null;
    }

    // Powiązanie „z tego skierowania powstała ta wizyta / to badanie".
    if (fulfilledByVisitId !== undefined) {
      data.fulfilledByVisitId = fulfilledByVisitId || null;
    }
    if (fulfilledByDocumentId !== undefined) {
      data.fulfilledByDocumentId = fulfilledByDocumentId || null;
    }

    const updated = await prisma.referral.update({
      where: { id },
      data,
      include: REFERRAL_INCLUDE,
    });

    return Response.json(updated);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
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
  if (!(await ensureOwnership(id, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.referral.delete({
      where: { id },
    });
    return Response.json({ ok: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { resolveEpisodeLink } from "@/lib/services/care-episodes";
import { isReferralStatus } from "@/lib/services/referrals";

export const runtime = "nodejs";

/** Powiązania skierowania — część ciała, leczenie i to, czym zostało zrealizowane. */
const REFERRAL_INCLUDE = {
  bodyPart: { select: { id: true, name: true } },
  episode: { select: { id: true, title: true, status: true } },
  fulfilledByVisit: { select: { id: true, doctorName: true, date: true, plannedDate: true, status: true } },
  fulfilledByDocument: { select: { id: true, title: true, studyDate: true, status: true } },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const referrals = await prisma.referral.findMany({
      where: { userId: session.user.id },
      orderBy: { issueDate: "desc" },
      include: REFERRAL_INCLUDE,
    });
    return Response.json(referrals);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title, specialization, doctorName, issueDate, expiryDate, code, notes,
      status, episodeId, bodyPartId,
    } = body;

    if (!title || !specialization || !issueDate) {
      return Response.json(
        { error: "Pola 'title', 'specialization' oraz 'issueDate' są wymagane." },
        { status: 400 }
      );
    }

    // Niezmiennik jak przy wizytach i badaniach: epizod pociąga część ciała.
    const episodeLink = await resolveEpisodeLink(session.user.id, episodeId);
    const referralStatus = isReferralStatus(status) ? status : "ACTIVE";

    const referral = await prisma.referral.create({
      data: {
        userId: session.user.id,
        status: referralStatus,
        // `isUsed` pisane równolegle do `status` — legacy, czytane już nigdzie.
        isUsed: referralStatus === "FULFILLED",
        episodeId: episodeLink?.episodeId ?? null,
        bodyPartId: episodeLink?.bodyPartId ?? (bodyPartId || null),
        title: title.trim(),
        specialization: specialization.trim(),
        doctorName: doctorName?.trim() || null,
        issueDate: new Date(issueDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        code: code?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: REFERRAL_INCLUDE,
    });

    return Response.json(referral, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

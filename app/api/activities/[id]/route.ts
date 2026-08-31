import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { IntensityClass, Prisma } from "@/app/generated/prisma";
import { recomputeActivityAnalytics, calculateVdot } from "@/lib/services/intensity";

export const runtime = "nodejs";

interface ActivityPatchInput {
  moodScore?: number | null;
  moodNote?: string | null;
  intensityClass?: IntensityClass | null; // null → clear override + auto-recompute
  intensityClassOverride?: boolean;        // explicit pin/unpin
  recomputeAnalytics?: boolean;            // force a fresh analytics pass
}

async function ensureOwnership(id: string, userId: string): Promise<boolean> {
  const a = await prisma.activity.findUnique({
    where: { id },
    select: { userId: true },
  });
  return !!a && a.userId === userId;
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

  const body = (await request.json()) as ActivityPatchInput;

  // Validate mood
  if (body.moodScore != null && (body.moodScore < 1 || body.moodScore > 5)) {
    return Response.json({ error: "moodScore must be 1-5" }, { status: 400 });
  }

  const data: Prisma.ActivityUpdateInput = {};

  if (body.moodScore !== undefined) data.moodScore = body.moodScore;
  if (body.moodNote !== undefined) data.moodNote = body.moodNote;

  // Intensity override semantics:
  //   - explicit class set → pin (override = true) and update
  //   - intensityClass: null + intensityClassOverride: false → clear pin, will auto-recompute
  if (body.intensityClass !== undefined) {
    if (body.intensityClass === null && body.intensityClassOverride === false) {
      data.intensityClass = null;
      data.intensityClassOverride = false;
    } else if (body.intensityClass !== null) {
      data.intensityClass = body.intensityClass;
      data.intensityClassOverride = true;
    }
  } else if (body.intensityClassOverride !== undefined) {
    data.intensityClassOverride = body.intensityClassOverride;
  }

  if (Object.keys(data).length > 0) {
    await prisma.activity.update({ where: { id }, data });
  }

  // If user pinned a TEMPO/THRESHOLD/RACE class, also recompute VDOT (might have changed).
  // If user cleared override, recompute everything.
  const shouldRecompute =
    body.recomputeAnalytics === true ||
    body.intensityClassOverride === false ||
    (body.intensityClass != null &&
      (body.intensityClass === IntensityClass.TEMPO ||
        body.intensityClass === IntensityClass.THRESHOLD ||
        body.intensityClass === IntensityClass.RACE));

  if (shouldRecompute) {
    if (body.intensityClassOverride === false) {
      // User cleared override → full recompute
      await recomputeActivityAnalytics(id);
    } else if (body.intensityClass != null) {
      // User pinned a class → only update VDOT (zones/class come from override)
      const a = await prisma.activity.findUnique({
        where: { id },
        select: { type: true, distance: true, duration: true },
      });
      if (a && a.type === "RUN" && a.distance) {
        const vdot = calculateVdot(a.distance, a.duration);
        await prisma.activity.update({
          where: { id },
          data: { vdotEstimate: vdot },
        });
      }
    }
  }

  const updated = await prisma.activity.findUnique({ where: { id } });
  return Response.json(updated);
}

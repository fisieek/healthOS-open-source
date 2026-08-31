import { auth } from "@/auth";
import { recomputeUserActivities } from "@/lib/services/intensity";
import { subDays } from "date-fns";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/activities/recompute?days=180
 *
 * Recomputes zone minutes / intensity class / VDOT for all activities
 * within the given window (default: last 180 days).
 *
 * Honors `intensityClassOverride` — won't change manually-pinned classes.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") ?? 180), 365);
  const from = subDays(new Date(), days);

  const result = await recomputeUserActivities(session.user.id, { from });
  return Response.json(result);
}

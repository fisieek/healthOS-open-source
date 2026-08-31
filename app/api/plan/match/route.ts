import { auth } from "@/auth";
import { matchPlanSessions } from "@/lib/services/plan-matcher";

export const runtime = "nodejs";

/**
 * POST /api/plan/match
 * Runs the auto-matcher for the current user's plan sessions.
 * Body (optional): { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD" }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    from?: string;
    to?: string;
  };

  try {
    const result = await matchPlanSessions(session.user.id, {
      from: body.from ? new Date(body.from) : undefined,
      to: body.to ? new Date(body.to) : undefined,
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Match failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

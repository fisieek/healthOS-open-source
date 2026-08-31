import { auth } from "@/auth";
import { classifyAndExtractIntake, IntakeError } from "@/lib/services/intake";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * POST /api/intake/<id>/classify
 *
 * Runs Gemini classify → routes to the matching extractor.
 * Idempotent-ish: re-runs the pipeline against the stored file.
 * Returns a payload the UI shows to the user for review/edit before final save.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let forceKind: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.forceKind === "string") {
      forceKind = body.forceKind;
    }
  } catch (err) {
    // Ignore body parsing errors for backward compatibility/no-body requests
  }

  try {
    const result = await classifyAndExtractIntake(session.user.id, id, forceKind);
    return Response.json(result);
  } catch (err) {
    if (err instanceof IntakeError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Classify failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

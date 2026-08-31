import { auth } from "@/auth";
import { persistIntakeFile, IntakeError } from "@/lib/services/intake";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/intake/upload  (multipart/form-data, field "file")
 *
 * Stores the file under a unique storage key and creates a HealthIntake row
 * in UPLOADED state. Returns intakeId — caller then triggers /classify to
 * run AI classification and routing.
 *
 * Limit: 15 MB. Allowed: jpeg/png/webp/heic/pdf.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const { intakeId, storage } = await persistIntakeFile(session.user.id, {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: buffer,
    });
    return Response.json({
      intakeId,
      url: storage.url,
      mimeType: storage.mimeType,
      size: storage.size,
    });
  } catch (err) {
    if (err instanceof IntakeError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

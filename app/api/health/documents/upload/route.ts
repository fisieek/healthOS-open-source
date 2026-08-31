import { auth } from "@/auth";
import { storage, generateKey } from "@/lib/services/storage";
import { readUploadedFile, UploadError } from "@/lib/services/upload-limits";

export const runtime = "nodejs";

// Węższa lista niż wspólna ALLOWED_DOCUMENT_MIME — skany zdjęciowe wgrywa się
// przez /api/intake, tutaj celowo tylko JPG/PNG/PDF.
const ALLOWED_MIME: ReadonlySet<string> = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
]);

/**
 * POST /api/health/documents/upload  (multipart/form-data, field "file")
 *
 * Simple file upload for health documents (imaging RTG/USG etc.).
 * Stores file via storage driver and returns URL. Does NOT create HealthIntake
 * or trigger AI classification — just persists the file.
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

    let buffer: Buffer;
    let mime: string;
    try {
        ({ buffer, mime } = await readUploadedFile(file, ALLOWED_MIME));
    } catch (err) {
        if (err instanceof UploadError) {
            return Response.json({ error: err.message }, { status: err.status });
        }
        throw err;
    }

    const key = generateKey(`documents/${session.user.id}`, file.name);
    const stored = await storage.put(key, buffer, mime);

    return Response.json({
        url: stored.url,
        key: stored.key,
        mimeType: stored.mimeType,
        size: stored.size,
        fileName: file.name,
    });
}

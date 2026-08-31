import { auth } from "@/auth";
import { extractBodyComposition } from "@/lib/services/gemini";
import { readUploadedFile, ALLOWED_DOCUMENT_MIME, UploadError } from "@/lib/services/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/log/body/upload
 * Multipart form: { file: File }
 * Zwraca wyekstrahowane przez Gemini parametry kompozycji ciała (preview).
 * Frontend potem wysyła wybrane wartości do /api/log/body do trwałego zapisu.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const files = (form.getAll("files").concat(form.getAll("file"))).filter(
      (f) => f instanceof File
    ) as File[];

    if (files.length === 0) {
      return Response.json({ error: "Brak plików 'files' lub 'file' do analizy" }, { status: 400 });
    }

    if (files.length > 5) {
      return Response.json({ error: "Możesz przesłać maksymalnie 5 plików jednocześnie" }, { status: 400 });
    }

    const imagesData: { base64: string; mimeType: string }[] = [];
    for (const file of files) {
      const { buffer, mime: mimeType } = await readUploadedFile(file, ALLOWED_DOCUMENT_MIME);
      imagesData.push({ base64: buffer.toString("base64"), mimeType });
    }

    const data = await extractBodyComposition(session.user.id, imagesData);
    return Response.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Błąd AI Upload Body:", error);
    return Response.json(
      { error: error.message || "Wystąpił błąd podczas analizy zdjęcia przez AI" },
      { status: 500 }
    );
  }
}

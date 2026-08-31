import { auth } from "@/auth";
import { extractRunningActivityFromPhoto } from "@/lib/services/gemini";
import { readUploadedFile, ALLOWED_IMAGE_MIME, UploadError } from "@/lib/services/upload-limits";

export const runtime = "nodejs";
export const maxDuration = 60; // AI parsing might take some time

/**
 * POST /api/bieg/upload
 * Odbiera plik graficzny (zegarka sportowego lub aplikacji),
 * przesyła do Gemini 3.5 Flash w celu wyekstrahowania parametrów biegu.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Brak pliku 'file' w żądaniu" }, { status: 400 });
    }

    const { buffer, mime: mimeType } = await readUploadedFile(file, ALLOWED_IMAGE_MIME);
    const base64 = buffer.toString("base64");

    const data = await extractRunningActivityFromPhoto(session.user.id, base64, mimeType);
    return Response.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Błąd AI Upload Bieg:", error);
    return Response.json(
      { error: error.message || "Wystąpił błąd podczas analizy zdjęcia przez AI" },
      { status: 500 }
    );
  }
}

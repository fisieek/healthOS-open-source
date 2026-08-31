/**
 * Wspólne reguły dla wgrywanych plików.
 *
 * Wcześniej limit rozmiaru i lista dozwolonych typów istniały w dwóch niemal
 * identycznych kopiach (documents/upload i intake.ts), a trzy inne trasy nie
 * miały ich wcale. Ten moduł jest jednym źródłem prawdy — celowo bez importu
 * `prisma` i bez niczego serwerowego, żeby dało się go użyć wszędzie.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/** Formaty graficzne, które przyjmuje Gemini. */
export const ALLOWED_IMAGE_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** To samo co wyżej plus PDF — dla skanów i dokumentów. */
export const ALLOWED_DOCUMENT_MIME: ReadonlySet<string> = new Set([
  ...ALLOWED_IMAGE_MIME,
  "application/pdf",
]);

export class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "UploadError";
  }
}

function formatMb(bytes: number): string {
  return String(Math.round(bytes / 1024 / 1024));
}

/**
 * Sprawdza typ i rozmiar, po czym wczytuje plik do bufora.
 *
 * Rozmiar sprawdzamy przed `arrayBuffer()`, żeby nie robić dodatkowej kopii
 * dużego pliku w pamięci. (Samo ciało żądania Next zdążył już zbuforować —
 * tego stąd nie da się uniknąć.)
 */
export async function readUploadedFile(
  file: File,
  allowed: ReadonlySet<string> = ALLOWED_DOCUMENT_MIME
): Promise<{ buffer: Buffer; mime: string }> {
  const mime = (file.type || "application/octet-stream").toLowerCase();

  if (!allowed.has(mime)) {
    const lista = [...allowed]
      .map((m) => m.split("/")[1].toUpperCase())
      .filter((m, i, a) => a.indexOf(m) === i)
      .join(", ");
    throw new UploadError(`Nieobsługiwany typ pliku: ${mime}. Dozwolone: ${lista}.`);
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`Plik za duży (max ${formatMb(MAX_UPLOAD_BYTES)} MB)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length === 0) {
    throw new UploadError("Pusty plik");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(`Plik za duży (max ${formatMb(MAX_UPLOAD_BYTES)} MB)`);
  }

  return { buffer, mime };
}

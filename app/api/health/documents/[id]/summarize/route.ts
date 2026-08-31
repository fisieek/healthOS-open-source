import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/services/storage";
import { extractImagingReport } from "@/lib/services/gemini";
import { IMAGING_MODALITIES } from "@/app/zdrowie/wizyty/constants";

export const runtime = "nodejs";

/**
 * POST /api/health/documents/[id]/summarize
 *
 * Analizuje załączony plik badania i zwraca **propozycje zmian**.
 *
 * ⚠️ Ta trasa celowo **niczego nie zapisuje**. Wcześniej nadpisywała w bazie
 * `description` (kasując opis wpisany ręcznie przez użytkownika) oraz `studyDate`
 * (przesuwając badanie w czasie bez żadnego śladu). Zasada nadrzędna projektu:
 * sugestia zawsze, akcja nigdy bez potwierdzenia.
 *
 * Zapis następuje dopiero po akceptacji użytkownika, przez istniejące
 * `PATCH /api/health/documents/[id]` — bez osobnej trasy.
 */

/** Pojedyncza propozycja: stan obecny, propozycja AI i czy cokolwiek zmienia. */
interface Suggestion<T> {
  current: T | null;
  proposed: T | null;
  /** `false` = AI proponuje to, co już jest (UI wyszarza i blokuje zaznaczenie). */
  changed: boolean;
}

function suggestion<T>(current: T | null, proposed: T | null): Suggestion<T> {
  const norm = (v: T | null) =>
    typeof v === "string" ? v.trim() : v ?? null;
  const c = norm(current);
  const p = norm(proposed);
  return {
    current: (c ?? null) as T | null,
    proposed: (p ?? null) as T | null,
    // Brak propozycji nie jest zmianą — AI po prostu nic nie znalazło.
    changed: p != null && p !== "" && p !== c,
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.healthDocument.findUnique({
    where: { id },
    select: {
      userId: true,
      fileUrl: true,
      doctor: true,
      studyDate: true,
      description: true,
      tags: true,
      episodeId: true,
      aiSuggestions: true,
      bodyPart: { select: { id: true, name: true } },
      episode: { select: { id: true, title: true } },
    },
  });

  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!existing.fileUrl) {
    return Response.json(
      { error: "Ten dokument nie posiada załączonego pliku" },
      { status: 400 }
    );
  }

  try {
    // 1. Wyciągnięcie storageKey z fileUrl
    let storageKey = existing.fileUrl.replace(/^\/api\/storage\//, "");
    storageKey = decodeURIComponent(storageKey);

    // 2. Pobranie pliku z magazynu
    const file = await storage.get(storageKey);
    if (!file) {
      return Response.json(
        { error: "Plik nie istnieje w pamięci masowej" },
        { status: 404 }
      );
    }

    // 3. Konwersja do base64 i analiza Gemini
    const base64 = file.data.toString("base64");
    const result = await extractImagingReport(session.user.id, base64, file.mimeType);

    // 4. Złożenie proponowanego opisu (dokładnie jak dotąd — zmienia się tylko to,
    //    że trafia do propozycji, a nie prosto do bazy).
    let descriptionText = `${result.summary}`;
    if (result.findings && result.findings.length > 0) {
      descriptionText +=
        `\n\nKLUCZOWE OBSERWACJE:\n` +
        result.findings.map((f) => `• ${f}`).join("\n");
    }
    if (result.conclusion) {
      descriptionText += `\n\nWNIOSKI:\n${result.conclusion}`;
    }
    if (result.bodyPart) {
      descriptionText += `\n\nOBSZAR ANATOMICZNY: ${result.bodyPart}`;
    }
    if (result.modality) {
      descriptionText += `\nMETODA BADANIA: ${result.modality}`;
    }

    // Data badania — tylko jeśli model zwrócił coś parsowalnego.
    let proposedStudyDate: string | null = null;
    if (result.studyDate) {
      const parsed = new Date(result.studyDate);
      if (!isNaN(parsed.getTime())) {
        proposedStudyDate = parsed.toISOString().slice(0, 10);
      }
    }

    // Modalność żyje w `tags[0]` — porównujemy z tym, co już tam jest.
    const currentTags = Array.isArray(existing.tags)
      ? (existing.tags as string[])
      : [];
    const currentModality =
      currentTags.find((t) => IMAGING_MODALITIES.includes(t)) ?? null;
    const proposedModality = IMAGING_MODALITIES.includes(result.modality)
      ? result.modality
      : null;

    // ─── Badanie kontrolne (poz. 5) ──────────────────────────────────────────
    // Termin liczymy od DATY BADANIA, nie od dziś — „kontrola za 6 miesięcy"
    // w opisie z lipca oznacza styczeń, niezależnie od tego, kiedy user wgrał plik.
    const followUpBase = proposedStudyDate
      ? new Date(proposedStudyDate)
      : existing.studyDate ?? null;

    let followUpDate: string | null = null;
    const f = result.followUp;
    if (f?.explicitDate) {
      followUpDate = f.explicitDate;
    } else if (f?.intervalMonths && followUpBase) {
      const d = new Date(followUpBase);
      d.setMonth(d.getMonth() + f.intervalMonths);
      followUpDate = d.toISOString().slice(0, 10);
    }
    // Brak obu → sugerujemy badanie bez terminu; user dopisze datę sam.

    // Odrzucone sugestie pamiętamy, żeby nie pytać drugi raz o to samo.
    const stored = (existing.aiSuggestions ?? null) as Record<string, any> | null;
    const followUpDismissed = stored?.followUp?.dismissed === true;

    return Response.json({
      documentId: id,
      followUp: f
        ? {
            recommended: true,
            what: f.what,
            modality: f.modality,
            date: followUpDate,
            quote: f.quote,
            dismissed: followUpDismissed,
            // Kontekst do prefilla nowego badania — user może go zmienić.
            bodyPartName: result.bodyPart ?? existing.bodyPart?.name ?? null,
            episodeId: existing.episodeId ?? null,
            episodeTitle: existing.episode?.title ?? null,
          }
        : null,
      suggestions: {
        description: suggestion(existing.description, descriptionText),
        studyDate: suggestion(
          existing.studyDate ? existing.studyDate.toISOString().slice(0, 10) : null,
          proposedStudyDate
        ),
        doctor: suggestion(existing.doctor, result.doctor),
        bodyPart: suggestion(existing.bodyPart?.name ?? null, result.bodyPart),
        modality: suggestion(currentModality, proposedModality),
      },
    });
  } catch (error: any) {
    console.error("Błąd podczas generowania podsumowania AI:", error);
    return Response.json(
      { error: `Nie udało się wygenerować podsumowania AI: ${error.message}` },
      { status: 500 }
    );
  }
}

import { prisma } from "@/lib/db";

/**
 * Klucz do Google Gemini dla KONKRETNEJ osoby.
 *
 * Wcześniej ta funkcja istniała w dwóch kopiach (`lib/ai/provider.ts`
 * i `lib/services/gemini.ts`) i obie przeglądały profile **wszystkich** kont
 * w bazie, biorąc pierwszy znaleziony klucz — niezależnie od tego, kto pyta.
 * Przy dwóch kontach oznaczało to, że rozmowy jednego szły na rachunek
 * drugiego, i nie było tego widać nigdzie w interfejsie.
 *
 * Kolejność bez zmian względem poprzedniej wersji: najpierw zmienna
 * środowiskowa (tryb webowy / `.env.local`), potem klucz zapisany przez tego
 * użytkownika w Ustawieniach. W spakowanej apce desktopowej nie ma zmiennych
 * środowiskowych, więc tam liczy się wyłącznie ta druga ścieżka — i to właśnie
 * tam błąd był odczuwalny.
 */
export async function getGeminiApiKey(userId: string): Promise<string> {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) return envKey;

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });

  const settings = (profile?.settings ?? {}) as Record<string, unknown>;
  const key = settings.geminiApiKey;
  if (typeof key === "string" && key.trim()) return key.trim();

  throw new Error(
    "GEMINI_API_KEY not configured — skonfiguruj klucz Gemini w Ustawieniach."
  );
}

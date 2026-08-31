/**
 * Klucz OAuth **aplikacji** do Kalendarza Google — jeden, wspólny dla wszystkich
 * użytkowników (poz. 9 etap 4).
 *
 * ─── Dlaczego sekret może tu być, skoro paczka jest jawna ───────────────────
 * Klucz musi być typu **„Aplikacja desktopowa"** (Desktop app) w Google Cloud
 * Console. Przy tym typie Google **wprost zakłada, że sekret nie jest tajny** —
 * aplikacja instalowana u użytkownika nie ma gdzie go schować. Bezpieczeństwa
 * pilnuje wtedy PKCE (patrz `pkce.ts`), a nie tajność sekretu.
 *
 * Tak działają `gcloud`, Thunderbird i każda inna aplikacja desktopowa
 * logująca się do Google.
 *
 * 🛑 **Nie zadziała to z kluczem typu „Aplikacja internetowa"** — tam sekret
 * jest traktowany serio i Google odrzuci wymianę kodu z aplikacji desktopowej.
 *
 * ─── Skąd się bierze wartość ────────────────────────────────────────────────
 * - wersja przeglądarkowa (dev): z `.env.local`
 * - aplikacja desktopowa: wstrzykiwane przez `buildNextEnv()` w `electron/main.ts`
 *
 * Dopóki puste, użytkownik może podać **własny** klucz w Ustawieniach —
 * to furtka na czas, zanim aplikacja przejdzie weryfikację Google.
 */

export const APP_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const APP_GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

/** Czy aplikacja ma własny klucz, czy użytkownik musi podać swój. */
export function hasAppGoogleClient(): boolean {
  return !!APP_GOOGLE_CLIENT_ID && !!APP_GOOGLE_CLIENT_SECRET;
}

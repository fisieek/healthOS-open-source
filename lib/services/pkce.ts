import crypto from "crypto";

/**
 * PKCE (RFC 7636) — zabezpieczenie logowania OAuth dla aplikacji, które nie mają
 * gdzie ukryć sekretu.
 *
 * Po co: healthOS jest aplikacją instalowaną u użytkownika, więc jej klucz OAuth
 * da się odczytać z dysku (patrz `lib/constants/google-oauth.ts`). Bez PKCE
 * ktoś, kto przechwyciłby kod autoryzacyjny z adresu powrotnego, mógłby wymienić
 * go na token, mając ten publicznie znany klucz.
 *
 * Jak działa: przy starcie losujemy `verifier` i wysyłamy do Google tylko jego
 * skrót (`challenge`). Kod autoryzacyjny da się wymienić na token **wyłącznie**
 * po okazaniu oryginalnego `verifier`, który nigdy nie opuścił tego komputera.
 */

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** Nazwa ciasteczka, w którym `verifier` czeka między przekierowaniami. */
export const PKCE_COOKIE = "healthos_google_pkce";

export function createPkcePair(): PkcePair {
  // 32 bajty → 43 znaki base64url, mieści się w wymaganym zakresie 43–128.
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

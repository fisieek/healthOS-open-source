import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma";
import {
  HEALTHOS_CALENDAR_NAME,
  type CalendarEvent,
} from "@/lib/constants/calendar-events";
import {
  APP_GOOGLE_CLIENT_ID,
  APP_GOOGLE_CLIENT_SECRET,
} from "@/lib/constants/google-oauth";

/**
 * Klient Kalendarza Google (poz. 9 etap 4) — OAuth i cztery operacje na zdarzeniach.
 *
 * **Bez biblioteki `googleapis`.** Potrzebujemy garstki końcówek REST-owych,
 * a każda nowa zależność w tym projekcie to ryzyko przy `npm install`
 * (pułapka 11 w fixes.md: `--legacy-peer-deps` przez konflikt `date-fns`).
 */

const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Najwęższe możliwe uprawnienie: pozwala zarządzać **wyłącznie kalendarzami,
 * które ta aplikacja sama założyła**.
 *
 * Świadomie NIE `calendar.events` (z pierwotnego szkicu w fixes.md) — tamto daje
 * dostęp do wszystkich wydarzeń użytkownika, także prywatnych i służbowych,
 * których healthOS nie ma prawa widzieć.
 */
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.app.created";

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(
  redirectUri: string,
  clientId: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    // `offline` + `consent` są wymagane, żeby Google w ogóle wydało refresh_token.
    // Bez nich integracja przestaje działać po godzinie i nie da się jej odnowić.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    // PKCE — klucz aplikacji desktopowej jest publiczny, więc to on, a nie
    // sekret, chroni wymianę kodu na token (patrz lib/services/pkce.ts).
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${OAUTH_AUTH}?${params}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
  codeVerifier: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * Zwraca ważny access token, odświeżając go w razie potrzeby.
 *
 * Margines 60 s, bo token wygasający „za chwilę" potrafi paść w połowie
 * synchronizacji — a wtedy część zdarzeń poszłaby, a część nie.
 */
export async function getValidAccessToken(
  userId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
  });
  if (!source?.accessToken) {
    throw new Error("Kalendarz Google nie jest podłączony");
  }

  const stillValid =
    source.tokenExpiresAt && source.tokenExpiresAt.getTime() - 60_000 > Date.now();
  if (stillValid) return source.accessToken;

  if (!source.refreshToken) {
    throw new Error("Brak tokenu odświeżającego — połącz konto Google ponownie");
  }

  const tokens = await refreshAccessToken(source.refreshToken, clientId, clientSecret);
  await prisma.dataSource.update({
    where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
    data: {
      accessToken: tokens.access_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      // Przy odświeżaniu Google zwykle NIE oddaje nowego refresh_token —
      // nadpisanie go pustką odcięłoby integrację na stałe.
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });
  return tokens.access_token;
}

// ─── Wywołania API ───────────────────────────────────────────────────────────

async function callGoogle(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

/**
 * Zwraca id kalendarza „healthOS", zakładając go przy pierwszym użyciu.
 *
 * Osobny kalendarz, nigdy główny — użytkownik może go schować albo skasować
 * jednym kliknięciem, bez grzebania w swoich wydarzeniach. Uprawnienie
 * `calendar.app.created` i tak nie pozwala nam dotknąć niczego innego.
 */
export async function ensureHealthCalendar(
  userId: string,
  token: string
): Promise<string> {
  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
    select: { settings: true },
  });
  const settings = (source?.settings ?? {}) as Record<string, unknown>;
  const known = settings.calendarId as string | undefined;

  if (known) {
    // Sprawdzamy, czy nadal istnieje — użytkownik mógł go skasować w Google.
    const check = await callGoogle(token, `/calendars/${encodeURIComponent(known)}`);
    if (check.ok) return known;
  }

  const res = await callGoogle(token, "/calendars", {
    method: "POST",
    body: JSON.stringify({
      summary: HEALTHOS_CALENDAR_NAME,
      description:
        "Terminy badań, wizyt i skierowań z aplikacji healthOS. Zarządzane automatycznie.",
    }),
  });
  if (!res.ok) {
    throw new Error(`Nie udało się założyć kalendarza: ${res.status} ${await res.text()}`);
  }
  const created = (await res.json()) as { id: string };

  await prisma.dataSource.update({
    where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
    data: { settings: { ...settings, calendarId: created.id } },
  });
  return created.id;
}

export async function insertEvent(
  token: string,
  calendarId: string,
  event: CalendarEvent
): Promise<string> {
  const res = await callGoogle(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(event) }
  );
  if (!res.ok) {
    throw new Error(`Nie udało się dodać zdarzenia: ${res.status} ${await res.text()}`);
  }
  const created = (await res.json()) as { id: string };
  return created.id;
}

export async function updateEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: CalendarEvent
): Promise<void> {
  const res = await callGoogle(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PUT", body: JSON.stringify(event) }
  );
  if (!res.ok) {
    throw new Error(`Nie udało się zaktualizować zdarzenia: ${res.status} ${await res.text()}`);
  }
}

/**
 * Kasuje zdarzenie. 404/410 traktujemy jako sukces — jeśli użytkownik usunął je
 * ręcznie w Google, cel i tak jest osiągnięty i nie ma po co przerywać całej
 * synchronizacji.
 */
export async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await callGoogle(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Nie udało się usunąć zdarzenia: ${res.status} ${await res.text()}`);
  }
}

/** Odbiera aplikacji dostęp po stronie Google — „Rozłącz" ma być prawdziwe. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => {
    // Cofnięcie po stronie Google jest „miłe", ale nie krytyczne — tokeny
    // i tak kasujemy lokalnie.
  });
}

// ─── Dane dostępowe użytkownika ──────────────────────────────────────────────

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  /** `app` = klucz wbudowany w aplikację, `user` = własny klucz użytkownika. */
  source: "app" | "user";
}

/**
 * Skąd bierzemy klucz OAuth.
 *
 * **Domyślnie klucz aplikacji** — zwykły użytkownik ma kliknąć „Połącz" i tyle,
 * a nie zakładać projekt w Google Cloud Console. To był błąd pierwszej wersji:
 * skopiowany wzorzec Stravy działał dla jednej osoby, ale nie dla wszystkich.
 *
 * Własny klucz użytkownika zostaje jako **furtka**: zanim aplikacja przejdzie
 * weryfikację Google, wbudowany klucz obsługuje ograniczoną liczbę kont, więc
 * ktoś techniczny może podstawić swój i nie czekać.
 */
export async function getGoogleCredentials(
  userId: string
): Promise<GoogleCredentials | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });
  const s = (profile?.settings ?? {}) as Record<string, unknown>;
  const ownId = (s.googleClientId as string) ?? "";
  const ownSecret = (s.googleClientSecret as string) ?? "";
  if (ownId && ownSecret) {
    return { clientId: ownId, clientSecret: ownSecret, source: "user" };
  }

  if (APP_GOOGLE_CLIENT_ID && APP_GOOGLE_CLIENT_SECRET) {
    return {
      clientId: APP_GOOGLE_CLIENT_ID,
      clientSecret: APP_GOOGLE_CLIENT_SECRET,
      source: "app",
    };
  }
  return null;
}

export function googleRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/integrations/google-calendar/callback`;
}

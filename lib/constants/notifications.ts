/**
 * Powiadomienia desktopowe (poz. 9 etap 3) — typy, ustawienia domyślne
 * i budowanie treści komunikatu.
 *
 * **Bez dostępu do bazy i bez importów z Electrona** — z tego pliku korzystają
 * trzy strony: formularz w `/settings` (klient), trasa API (serwer Next)
 * i proces główny Electrona. Ten sam powód, dla którego istnieje
 * `lib/constants/agenda.ts` — patrz komentarz na jego górze.
 */

import {
  AGENDA_KIND_LABEL,
  whenLabel,
  type AgendaItem,
} from "./agenda";

/** Ile dni naprzód traktujemy jako „nadchodzące" w powiadomieniu. */
export const LEAD_DAYS_VALUES = [1, 3, 7] as const;
export type LeadDays = (typeof LEAD_DAYS_VALUES)[number];

export interface DesktopNotificationPrefs {
  enabled: boolean;
  /** Godzina 0–23 (czas lokalny), o której leci dzienne sprawdzenie. */
  hour: number;
  leadDays: LeadDays;
}

/**
 * Domyślnie **wyłączone**. Powiadomienie o zaległym badaniu potrafi wyskoczyć
 * przy cudzym ekranie, więc włączenie ma być świadomą decyzją użytkownika —
 * ta sama zasada, co przy synchronizacji z Google (poz. 9 etap 4d).
 */
export const DEFAULT_NOTIFICATION_PREFS: DesktopNotificationPrefs = {
  enabled: false,
  hour: 9,
  leadDays: 3,
};

export const LEAD_DAYS_OPTIONS: { value: LeadDays; label: string }[] = [
  { value: 1, label: "Dzień wcześniej" },
  { value: 3, label: "3 dni wcześniej" },
  { value: 7, label: "Tydzień wcześniej" },
];

/**
 * Czyta ustawienia z `UserProfile.settings` (Json) i sprowadza do bezpiecznych
 * wartości. Json z bazy jest nieufany — może pochodzić ze starszej wersji apki
 * albo z ręcznej edycji, więc każde pole walidujemy osobno.
 */
export function parseNotificationPrefs(raw: unknown): DesktopNotificationPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_NOTIFICATION_PREFS };
  const o = raw as Record<string, unknown>;

  const hour =
    typeof o.hour === "number" && Number.isInteger(o.hour) && o.hour >= 0 && o.hour <= 23
      ? o.hour
      : DEFAULT_NOTIFICATION_PREFS.hour;

  const leadDays = LEAD_DAYS_VALUES.includes(o.leadDays as LeadDays)
    ? (o.leadDays as LeadDays)
    : DEFAULT_NOTIFICATION_PREFS.leadDays;

  return {
    enabled: o.enabled === true,
    hour,
    leadDays,
  };
}

/** „2 pozycje" / „5 pozycji" / „1 pozycja" — polska odmiana przez przypadki. */
function plPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

export interface NotificationMessage {
  title: string;
  body: string;
}

/** Ile pozycji wchodzi do treści dymka, zanim dopiszemy „i N więcej". */
const MAX_LINES = 4;

/**
 * Buduje komunikat z zaległych i nadchodzących pozycji agendy.
 *
 * Zwraca `null`, gdy nie ma o czym powiadamiać — wywołujący ma wtedy **nic
 * nie pokazywać**, zamiast dymka „wszystko w porządku". Powiadomienie bez
 * treści to szum, który uczy użytkownika je ignorować.
 */
export function buildNotificationMessage(
  overdue: AgendaItem[],
  upcoming: AgendaItem[]
): NotificationMessage | null {
  if (overdue.length === 0 && upcoming.length === 0) return null;

  const o = overdue.length;
  const u = upcoming.length;

  let title: string;
  if (o > 0 && u > 0) {
    title = `${o} ${plPlural(o, "zaległa", "zaległe", "zaległych")}, ${u} ${plPlural(u, "nadchodząca", "nadchodzące", "nadchodzących")}`;
  } else if (o > 0) {
    title = `${o} ${plPlural(o, "zaległa pozycja", "zaległe pozycje", "zaległych pozycji")}`;
  } else {
    title = `${u} ${plPlural(u, "nadchodząca pozycja", "nadchodzące pozycje", "nadchodzących pozycji")}`;
  }

  // Zaległe na górze — są pilniejsze niż to, co dopiero przyjdzie.
  const all = [...overdue, ...upcoming];
  const shown = all.slice(0, MAX_LINES);
  const lines = shown.map(
    (i) => `${AGENDA_KIND_LABEL[i.kind]}: ${i.title} — ${whenLabel(i)}`
  );

  const rest = all.length - shown.length;
  if (rest > 0) lines.push(`…i ${rest} więcej`);

  return { title, body: lines.join("\n") };
}

/**
 * Typy i czyste funkcje agendy — **bez dostępu do bazy**.
 *
 * Wydzielone z `lib/services/health-agenda.ts`, bo panel jest komponentem
 * klienckim: import z serwisu wciągał Prismę → better-sqlite3 → `fs` do bundla
 * przeglądarki i wywalał build na „Can't resolve 'fs'".
 * Wszystko, czego dotyka klient, musi żyć tutaj.
 */

export type AgendaKind =
  | "EXAM"
  | "VISIT"
  | "FOLLOW_UP"
  | "REFERRAL_EXPIRY"
  | "DENTAL";

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  title: string;
  /** null = termin nieustalony. */
  date: string | null;
  overdue: boolean;
  bodyPartId: string | null;
  bodyPartName: string | null;
  episodeId: string | null;
  episodeTitle: string | null;
  /** Dodatkowy kontekst do wiersza (lekarz, specjalizacja, źródło kontroli). */
  detail: string | null;
  /**
   * Poniższe trzy pola zasilają wyłącznie zdarzenia Kalendarza Google
   * (poz. 9 etap 4) — panel agendy i kafelek ich nie używają. Opcjonalne,
   * żeby istniejące wywołania nie wymagały zmian.
   */
  doctorName?: string | null;
  facilityName?: string | null;
  facilityAddress?: string | null;
  specialization?: string | null;
}

export interface AgendaBuckets {
  overdue: AgendaItem[];
  upcoming: AgendaItem[];
  undated: AgendaItem[];
}

export const AGENDA_KIND_LABEL: Record<AgendaKind, string> = {
  EXAM: "Badanie",
  VISIT: "Wizyta",
  FOLLOW_UP: "Kontrola",
  REFERRAL_EXPIRY: "Skierowanie",
  DENTAL: "Zabieg",
};

function startOfDay(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Ile dni dzieli termin od dziś; ujemne = zaległe, null = brak terminu. */
export function daysFromToday(
  date: string | null,
  now: Date = new Date()
): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
}

/**
 * „za 3 dni" / „18 dni temu" / „dziś" / „termin nieustalony".
 *
 * Mieszka tutaj, bo mają to wspólne trzy miejsca: panel agendy, kafelek
 * na Dashboardzie i powiadomienia desktopowe (poz. 9 etap 3).
 */
export function whenLabel(item: Pick<AgendaItem, "date">): string {
  const days = daysFromToday(item.date);
  if (days === null) return "termin nieustalony";
  if (days === 0) return "dziś";
  if (days < 0) {
    const n = Math.abs(days);
    return `${n} ${n === 1 ? "dzień" : "dni"} temu`;
  }
  return `za ${days} ${days === 1 ? "dzień" : "dni"}`;
}

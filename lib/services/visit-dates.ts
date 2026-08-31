import { format } from "date-fns";

/**
 * Jedno źródło prawdy dla terminu wizyty.
 *
 * `MedicalVisit.date` jest NOT NULL, więc wizyta zaplanowana bez ustalonego
 * terminu dostaje przy zapisie **placeholder = dziś** (patrz `api/health/visits`),
 * a prawdziwy termin siedzi w `plannedDate` (NULL = nieustalony). Skutek: listy
 * sortowane po `date` wrzucały taką wizytę pomiędzy dzisiejsze, a karty
 * wyświetlały dzisiejszą datę jako jej termin.
 *
 * Kolumny `hasNoDate` **nie dokładamy** — stan „bez terminu" jest w pełni
 * wyprowadzalny z pary (`status`, `plannedDate`), bo POST/PATCH ustawiają
 * `plannedDate` zawsze, gdy użytkownik poda datę wizyty innej niż wykonana.
 * To dokładnie ten sam warunek, który miał posłużyć za backfill kolumny.
 */
export interface VisitDateLike {
  date: Date | string;
  plannedDate: Date | string | null;
  status: string;
}

export const NO_DATE_LABEL = "Termin nieustalony";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `true` gdy wizyta nie ma jeszcze ustalonego terminu (a `date` to placeholder). */
export function visitHasNoDate(v: VisitDateLike): boolean {
  return v.status !== "DONE" && v.plannedDate == null;
}

/** Termin do wyświetlenia; `null` = „Termin nieustalony". */
export function visitDisplayDate(v: VisitDateLike): Date | null {
  if (v.status === "DONE") return toDate(v.date);
  return v.plannedDate != null ? toDate(v.plannedDate) : null;
}

/** Termin sformatowany do UI — albo etykieta „Termin nieustalony". */
export function formatVisitDate(v: VisitDateLike, pattern = "dd.MM.yyyy"): string {
  const d = visitDisplayDate(v);
  return d ? format(d, pattern) : NO_DATE_LABEL;
}

/**
 * Klucz sortowania. Wizyty bez terminu dostają `-Infinity`, więc przy
 * porządku malejącym lądują na końcu listy — nie udają dzisiejszych.
 */
export function visitSortKey(v: VisitDateLike): number {
  const d = visitDisplayDate(v);
  return d ? d.getTime() : Number.NEGATIVE_INFINITY;
}

/** Sortowanie malejące (najnowsze najpierw), stabilne dla wizyt bez terminu. */
export function sortVisitsDesc<T extends VisitDateLike>(visits: T[]): T[] {
  return [...visits].sort((a, b) => {
    const ka = visitSortKey(a);
    const kb = visitSortKey(b);
    if (ka === kb) return 0;
    return kb - ka;
  });
}

/**
 * Rozdziela listę na wizyty z terminem (posortowane malejąco) i bez terminu.
 * UI pokazuje te drugie w osobnej sekcji „Bez ustalonego terminu" na dole,
 * zamiast wmieszane w chronologię.
 */
export function splitVisitsByDate<T extends VisitDateLike>(
  visits: T[]
): { dated: T[]; undated: T[] } {
  const dated: T[] = [];
  const undated: T[] = [];
  for (const v of visits) {
    if (visitHasNoDate(v)) undated.push(v);
    else dated.push(v);
  }
  return { dated: sortVisitsDesc(dated), undated };
}

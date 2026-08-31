import { prisma } from "@/lib/db";
import { visitDisplayDate } from "@/lib/services/visit-dates";
import { effectiveReferralStatus } from "@/lib/services/referrals";
import {
  daysFromToday,
  type AgendaItem,
  type AgendaBuckets,
} from "@/lib/constants/agenda";

// Typy i etykiety żyją w `lib/constants/agenda.ts` (bez Prismy), żeby mógł je
// importować komponent kliencki. Re-eksport dla wygody wywołujących po stronie serwera.
export {
  AGENDA_KIND_LABEL,
  daysFromToday,
  type AgendaKind,
  type AgendaItem,
  type AgendaBuckets,
} from "@/lib/constants/agenda";

/**
 * Jedno źródło odpowiedzi na pytanie „co mam zrobić i kiedy".
 *
 * Dziś ta informacja jest rozsypana po czterech zakładkach: zaplanowane badanie
 * widać w RTG/USG, zaplanowaną wizytę w wizytach, `followUpDate` dopiero po
 * otwarciu konkretnej wizyty, a wygasające skierowanie w profilaktyce.
 * Agenda zbiera to w jedną listę.
 *
 * Bez zmian schematu — wszystkie źródła istnieją po grupie C.
 */


/**
 * Zbiera agendę użytkownika z pięciu źródeł.
 *
 * `horizonDays` ogranicza sekcję „nadchodzące"; zaległe i bez terminu wchodzą
 * zawsze, bo to one wymagają reakcji.
 */
export async function collectAgendaItems(userId: string): Promise<AgendaItem[]> {
  const [documents, visits, dentalRecords, referrals] = await Promise.all([
    prisma.healthDocument.findMany({
      where: { userId, OR: [{ status: "PLANNED" }, { followUpDate: { not: null } }] },
      select: {
        id: true,
        title: true,
        status: true,
        plannedDate: true,
        followUpDate: true,
        followUpNote: true,
        bodyPart: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true } },
        facilityRef: { select: { name: true, address: true } },
      },
    }),
    prisma.medicalVisit.findMany({
      where: { userId, OR: [{ status: "PLANNED" }, { followUpDate: { not: null } }] },
      select: {
        id: true,
        date: true,
        plannedDate: true,
        status: true,
        doctorName: true,
        specialization: true,
        followUpDate: true,
        followUpNote: true,
        bodyPart: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true } },
        doctorRef: { select: { name: true } },
        facilityRef: { select: { name: true, address: true } },
      },
    }),
    prisma.dentalRecord.findMany({
      where: { userId, status: "PLANNED" },
      select: {
        id: true,
        procedure: true,
        toothNumber: true,
        plannedDate: true,
        dentistRef: { select: { name: true } },
        facilityRef: { select: { name: true, address: true } },
        episode: { select: { id: true, title: true, bodyPart: { select: { id: true, name: true } } } },
      },
    }),
    prisma.referral.findMany({
      where: { userId, expiryDate: { not: null } },
      select: {
        id: true,
        title: true,
        specialization: true,
        status: true,
        isUsed: true,
        expiryDate: true,
        bodyPart: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true } },
      },
    }),
  ]);

  const items: AgendaItem[] = [];
  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  for (const d of documents) {
    if (d.status === "PLANNED") {
      items.push({
        id: `exam-${d.id}`,
        kind: "EXAM",
        title: d.title,
        date: iso(d.plannedDate),
        overdue: false,
        bodyPartId: d.bodyPart?.id ?? null,
        bodyPartName: d.bodyPart?.name ?? null,
        episodeId: d.episode?.id ?? null,
        episodeTitle: d.episode?.title ?? null,
        detail: null,
        facilityName: d.facilityRef?.name ?? null,
        facilityAddress: d.facilityRef?.address ?? null,
      });
    }
    // Kontrola zalecona w opisie badania (poz. 5) — dotąd nigdzie nieagregowana.
    if (d.followUpDate) {
      items.push({
        id: `followup-doc-${d.id}`,
        kind: "FOLLOW_UP",
        title: d.followUpNote || `Kontrola po: ${d.title}`,
        date: iso(d.followUpDate),
        overdue: false,
        bodyPartId: d.bodyPart?.id ?? null,
        bodyPartName: d.bodyPart?.name ?? null,
        episodeId: d.episode?.id ?? null,
        episodeTitle: d.episode?.title ?? null,
        detail: `z badania: ${d.title}`,
        facilityName: d.facilityRef?.name ?? null,
        facilityAddress: d.facilityRef?.address ?? null,
      });
    }
  }

  for (const v of visits) {
    if (v.status === "PLANNED") {
      items.push({
        id: `visit-${v.id}`,
        kind: "VISIT",
        title: v.doctorName,
        date: iso(visitDisplayDate(v)),
        overdue: false,
        bodyPartId: v.bodyPart?.id ?? null,
        bodyPartName: v.bodyPart?.name ?? null,
        episodeId: v.episode?.id ?? null,
        episodeTitle: v.episode?.title ?? null,
        detail: v.specialization,
        specialization: v.specialization,
        // doctorRef ma pierwszeństwo nad `doctorName` — ta druga to legacy
        // wolny tekst, zastąpiony słownikiem (patrz schema.prisma).
        doctorName: v.doctorRef?.name ?? v.doctorName ?? null,
        facilityName: v.facilityRef?.name ?? null,
        facilityAddress: v.facilityRef?.address ?? null,
      });
    }
    // `MedicalVisit.followUpDate` istniało od dawna, ale było widoczne wyłącznie
    // po otwarciu konkretnej wizyty.
    if (v.followUpDate) {
      items.push({
        id: `followup-visit-${v.id}`,
        kind: "FOLLOW_UP",
        title: v.followUpNote || `Kontrola u: ${v.doctorName}`,
        date: iso(v.followUpDate),
        overdue: false,
        bodyPartId: v.bodyPart?.id ?? null,
        bodyPartName: v.bodyPart?.name ?? null,
        episodeId: v.episode?.id ?? null,
        episodeTitle: v.episode?.title ?? null,
        detail: `z wizyty: ${v.doctorName}`,
        doctorName: v.doctorRef?.name ?? v.doctorName ?? null,
        facilityName: v.facilityRef?.name ?? null,
        facilityAddress: v.facilityRef?.address ?? null,
      });
    }
  }

  for (const r of dentalRecords) {
    items.push({
      id: `dental-${r.id}`,
      kind: "DENTAL",
      title:
        r.toothNumber != null ? `${r.procedure} — ząb ${r.toothNumber}` : r.procedure,
      date: iso(r.plannedDate),
      overdue: false,
      bodyPartId: r.episode?.bodyPart?.id ?? null,
      bodyPartName: r.episode?.bodyPart?.name ?? null,
      episodeId: r.episode?.id ?? null,
      episodeTitle: r.episode?.title ?? null,
      detail: r.dentistRef?.name ?? null,
      doctorName: r.dentistRef?.name ?? null,
      facilityName: r.facilityRef?.name ?? null,
      facilityAddress: r.facilityRef?.address ?? null,
    });
  }

  for (const r of referrals) {
    // Zrealizowane i anulowane nie wymagają już reakcji.
    const status = effectiveReferralStatus(r);
    if (status === "FULFILLED" || status === "CANCELLED") continue;
    items.push({
      id: `referral-${r.id}`,
      kind: "REFERRAL_EXPIRY",
      title: r.title,
      date: iso(r.expiryDate),
      overdue: false,
      bodyPartId: r.bodyPart?.id ?? null,
      bodyPartName: r.bodyPart?.name ?? null,
      episodeId: r.episode?.id ?? null,
      episodeTitle: r.episode?.title ?? null,
      detail: `traci ważność · ${r.specialization}`,
      specialization: r.specialization,
    });
  }

  return items;
}

/**
 * Płaska lista pozycji — pod widok kalendarza.
 *
 * - `from`/`to` zawężają do zakresu dat (pozycje bez terminu są wtedy pomijane);
 * - `onlyUndated` zwraca wyłącznie pozycje bez terminu, niezależnie od zakresu.
 *   Kalendarz pokazuje je w osobnej liście pod siatką, bo nie należą do żadnego
 *   miesiąca.
 */
export async function getAgendaItems(
  userId: string,
  opts?: { from?: Date; to?: Date; onlyUndated?: boolean }
): Promise<AgendaItem[]> {
  const items = await collectAgendaItems(userId);
  const from = opts?.from ? opts.from.getTime() : null;
  const to = opts?.to ? opts.to.getTime() : null;
  const now = new Date();

  return items
    .filter((i) => {
      if (opts?.onlyUndated) return !i.date;
      if (!i.date) return false;
      const t = new Date(i.date).getTime();
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
      return true;
    })
    .map((i) => {
      const days = daysFromToday(i.date, now);
      return { ...i, overdue: days !== null && days < 0 };
    })
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}

/**
 * Agenda pogrupowana na zaległe / nadchodzące / bez terminu — pod panel „Co Cię czeka".
 */
export async function getAgenda(
  userId: string,
  opts?: { horizonDays?: number; now?: Date }
): Promise<AgendaBuckets> {
  const now = opts?.now ?? new Date();
  const horizonDays = opts?.horizonDays ?? 30;
  const items = await collectAgendaItems(userId);

  const overdue: AgendaItem[] = [];
  const upcoming: AgendaItem[] = [];
  const undated: AgendaItem[] = [];

  for (const item of items) {
    const days = daysFromToday(item.date, now);
    if (days === null) {
      undated.push(item);
    } else if (days < 0) {
      overdue.push({ ...item, overdue: true });
    } else if (days <= horizonDays) {
      upcoming.push(item);
    }
    // Dalsze niż horyzont pomijamy — panel ma odpowiadać „co teraz", nie archiwizować.
  }

  const byDate = (a: AgendaItem, b: AgendaItem) =>
    new Date(a.date!).getTime() - new Date(b.date!).getTime();

  // Zaległe: najstarsze (najbardziej zaległe) na górze.
  overdue.sort(byDate);
  upcoming.sort(byDate);

  return { overdue, upcoming, undated };
}

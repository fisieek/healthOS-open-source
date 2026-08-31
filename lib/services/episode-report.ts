import { prisma } from "@/lib/db";
import {
  matchBiomarker,
  parseNumericValue,
  getDefaultBiomarkersWithIds,
} from "@/lib/constants/biomarkers";
import { visitDisplayDate } from "@/lib/services/visit-dates";
import { effectiveReferralStatus } from "@/lib/services/referrals";

/**
 * Zbieranie pełnej historii jednego epizodu leczenia — pod raport dla lekarza
 * i pod eksport JSON.
 *
 * Model epizodów zbiera już wszystko, czego trzeba (wizyty, badania, leki,
 * zabiegi, skierowania), więc to jest głównie kwestia ułożenia danych w jedną
 * oś czasu — zero zmian schematu.
 */

export type ReportEntryKind = "VISIT" | "EXAM" | "DENTAL";

/** Pojedynczy wynik z badania, z oceną względem normy. */
export interface ReportParameter {
  name: string;
  value: string;
  unit: string;
  norm: string;
  /** HIGH/LOW wyróżniamy w druku — lekarz skanuje wzrokiem, nie czyta. */
  status: "NORMAL" | "HIGH" | "LOW" | "UNKNOWN";
}

export interface ReportEntry {
  id: string;
  kind: ReportEntryKind;
  /** null = termin nieustalony. */
  date: Date | null;
  title: string;
  subtitle: string | null;
  /** Zaplanowane pozycje idą do osobnej sekcji, nie w przebieg. */
  planned: boolean;
  doctor: string | null;
  facility: string | null;
  /** Wnioski / diagnoza. */
  summary: string | null;
  /** Pełny opis — pomijany, gdy user wybierze „tylko wnioski". */
  description: string | null;
  recommendations: string | null;
  followUpDate: Date | null;
  followUpNote: string | null;
  parameters: ReportParameter[];
  fileName: string | null;
}

export interface EpisodeReport {
  episode: {
    id: string;
    title: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    outcome: string | null;
    notes: string | null;
    bodyPartName: string;
  };
  patient: {
    name: string | null;
    birthDate: Date | null;
    ageYears: number | null;
  };
  /** Wizyty, badania i zabiegi w jednej chronologii — postulat S5. */
  timeline: ReportEntry[];
  /** Pozycje zaplanowane (jeszcze niewykonane). */
  planned: ReportEntry[];
  medications: {
    id: string;
    name: string;
    dose: string | null;
    frequency: string | null;
    startDate: Date;
    endDate: Date | null;
  }[];
  referrals: {
    id: string;
    title: string;
    specialization: string;
    issueDate: Date;
    expiryDate: Date | null;
    status: string;
  }[];
  attachments: { name: string; url: string }[];
  counts: {
    visits: number;
    examsDone: number;
    examsPlanned: number;
    medications: number;
  };
  /** Lekarze prowadzący — najczęściej występujący w wizytach epizodu. */
  leadDoctors: string[];
  generatedAt: Date;
}

function ageFrom(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Normalizacja jednostki do porównania: małe litery, bez spacji i kropek,
 * „µ" i „mc" → „u".
 */
function normUnit(u: string): string {
  return u
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/µ/g, "u")
    .replace(/^mc/, "u");
}

/**
 * Jednostki o TEJ SAMEJ skali liczbowej — wynik podany w jednej można porównać
 * z normą wyrażoną w drugiej bez przeliczania.
 *
 * Świadomie wąska lista. Np. `ng/dl` i `pmol/l` NIE są tu razem: to inne skale
 * (masowa vs molowa), więc FT4 12.1 pmol/l porównane z normą 0.93–1.7 ng/dl
 * dałoby fałszywe „POZA NORMĄ" — a fałszywy alarm na kartce dla lekarza jest
 * gorszy niż brak oznaczenia.
 */
const EQUIVALENT_UNITS: string[][] = [
  ["uiu/ml", "miu/l"],
  ["ng/ml", "ug/l"],
  ["pg/ml", "ng/l"],
  ["mg/l", "ug/ml"],
];

function comparableUnits(resultUnit: string, normUnitStr: string): boolean {
  // Brak jednostki przy wyniku = przyjmujemy jednostkę ze słownika.
  if (!resultUnit.trim()) return true;
  const a = normUnit(resultUnit);
  const b = normUnit(normUnitStr);
  if (!b) return true;
  if (a === b) return true;
  return EQUIVALENT_UNITS.some((g) => g.includes(a) && g.includes(b));
}

/** Ocena wyniku względem normy ze słownika biomarkerów użytkownika. */
function evaluateParameters(
  raw: unknown,
  biomarkers: any[]
): ReportParameter[] {
  if (!raw || typeof raw !== "object") return [];
  const params = raw as Record<string, { value: string; unit?: string }>;
  const out: ReportParameter[] = [];

  for (const [name, data] of Object.entries(params)) {
    if (!data || typeof data.value !== "string") continue;
    const dict = matchBiomarker(name, biomarkers, data.unit);
    const unit = data.unit || dict?.unit || "";
    const numVal = parseNumericValue(data.value);

    const normMin = dict?.normMin ?? null;
    const normMax = dict?.normMax ?? null;

    let norm: string = "—";
    if (normMin != null && normMax != null) norm = `${normMin}–${normMax}`;
    else if (normMin != null) norm = `≥ ${normMin}`;
    else if (normMax != null) norm = `≤ ${normMax}`;

    // Porównujemy TYLKO gdy jednostka wyniku jest zgodna z jednostką normy.
    // Inaczej lekarz dostałby ostrzeżenie wynikające z przelicznika, nie z wyniku.
    const unitsOk = comparableUnits(data.unit || "", dict?.unit || "");

    let status: ReportParameter["status"] = "UNKNOWN";
    if (!isNaN(numVal) && unitsOk) {
      status = "NORMAL";
      if (normMin != null && numVal < normMin) status = "LOW";
      else if (normMax != null && numVal > normMax) status = "HIGH";
    }

    // Gdy jednostki się rozjeżdżają, pokazujemy normę z jej jednostką — żeby
    // było widać, dlaczego nie ma oceny.
    if (!unitsOk && norm !== "—" && dict?.unit) {
      norm = `${norm} ${dict.unit}`;
    }

    out.push({ name: dict?.name || name, value: data.value, unit, norm, status });
  }
  return out;
}

function fileNameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(url.split("/").pop() || url);
  } catch {
    return url;
  }
}

/**
 * Zwraca `null`, gdy epizod nie istnieje albo należy do innego użytkownika —
 * wywołujący odpowiada za 404.
 */
export async function getEpisodeReport(
  userId: string,
  episodeId: string
): Promise<EpisodeReport | null> {
  const episode = await prisma.careEpisode.findFirst({
    where: { id: episodeId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      outcome: true,
      notes: true,
      bodyPart: { select: { name: true } },
    },
  });
  if (!episode) return null;

  const [visits, documents, medications, dentalRecords, referrals, profile, user] =
    await Promise.all([
      prisma.medicalVisit.findMany({
        where: { userId, episodeId },
        include: {
          doctorRef: { select: { name: true, specialization: true } },
          facilityRef: { select: { name: true } },
        },
      }),
      prisma.healthDocument.findMany({
        where: { userId, episodeId },
        include: {
          performingDoctor: { select: { name: true } },
          orderingDoctor: { select: { name: true } },
          facilityRef: { select: { name: true } },
        },
      }),
      prisma.medication.findMany({
        where: { userId, episodeId },
        orderBy: { startDate: "asc" },
      }),
      prisma.dentalRecord.findMany({
        where: { userId, episodeId },
        include: {
          dentistRef: { select: { name: true } },
          facilityRef: { select: { name: true } },
        },
      }),
      prisma.referral.findMany({
        where: { userId, episodeId },
        orderBy: { issueDate: "asc" },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { birthDate: true, settings: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

  // Słownik biomarkerów czytamy bez efektów ubocznych — raport niczego nie zapisuje.
  const settings = (profile?.settings as any) ?? {};
  const biomarkers: any[] =
    Array.isArray(settings.biomarkers) && settings.biomarkers.length > 0
      ? settings.biomarkers
      : getDefaultBiomarkersWithIds();

  const entries: ReportEntry[] = [];

  for (const v of visits) {
    entries.push({
      id: v.id,
      kind: "VISIT",
      date: visitDisplayDate(v),
      title: v.doctorRef?.name ?? v.doctorName,
      subtitle: v.specialization,
      planned: v.status === "PLANNED",
      doctor: v.doctorRef?.name ?? v.doctorName,
      facility: v.facilityRef?.name ?? v.facility,
      summary: v.summary,
      description: null,
      recommendations: v.recommendations,
      followUpDate: v.followUpDate,
      followUpNote: v.followUpNote,
      parameters: [],
      fileName: null,
    });
  }

  for (const d of documents) {
    entries.push({
      id: d.id,
      kind: "EXAM",
      date: d.status === "PLANNED" ? d.plannedDate : d.studyDate,
      title: d.title,
      subtitle: d.facilityRef?.name ?? d.laboratory,
      planned: d.status === "PLANNED",
      doctor: d.performingDoctor?.name ?? d.orderingDoctor?.name ?? d.doctor,
      facility: d.facilityRef?.name ?? d.laboratory,
      summary: null,
      description: d.description,
      recommendations: null,
      followUpDate: d.followUpDate,
      followUpNote: d.followUpNote,
      parameters: evaluateParameters(d.parameters, biomarkers),
      fileName: fileNameFromUrl(d.fileUrl),
    });
  }

  for (const r of dentalRecords) {
    entries.push({
      id: r.id,
      kind: "DENTAL",
      date: r.status === "PLANNED" ? r.plannedDate : r.date,
      title:
        r.toothNumber != null
          ? `${r.procedure} — ząb ${r.toothNumber}`
          : r.procedure,
      subtitle: r.facilityRef?.name ?? r.facility,
      planned: r.status === "PLANNED",
      doctor: r.dentistRef?.name ?? r.dentist,
      facility: r.facilityRef?.name ?? r.facility,
      summary: null,
      description: r.notes,
      recommendations: null,
      followUpDate: null,
      followUpNote: null,
      parameters: [],
      fileName: null,
    });
  }

  // Jedna chronologia; pozycje bez terminu lądują na końcu swojej sekcji.
  const byDate = (a: ReportEntry, b: ReportEntry) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() - b.date.getTime();
  };

  const timeline = entries.filter((e) => !e.planned).sort(byDate);
  const planned = entries.filter((e) => e.planned).sort(byDate);

  // Lekarze prowadzący — po liczbie wizyt, malejąco.
  const doctorCounts = new Map<string, number>();
  for (const v of visits) {
    const name = v.doctorRef?.name ?? v.doctorName;
    if (name) doctorCounts.set(name, (doctorCounts.get(name) ?? 0) + 1);
  }
  const leadDoctors = [...doctorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const attachments = documents
    .filter((d) => d.fileUrl)
    .map((d) => ({ name: fileNameFromUrl(d.fileUrl)!, url: d.fileUrl! }));

  return {
    episode: {
      id: episode.id,
      title: episode.title,
      status: episode.status,
      startDate: episode.startDate,
      endDate: episode.endDate,
      outcome: episode.outcome,
      notes: episode.notes,
      bodyPartName: episode.bodyPart.name,
    },
    patient: {
      name: user?.name ?? null,
      birthDate: profile?.birthDate ?? null,
      ageYears: ageFrom(profile?.birthDate ?? null),
    },
    timeline,
    planned,
    medications: medications.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
      startDate: m.startDate,
      endDate: m.endDate,
    })),
    referrals: referrals.map((r) => ({
      id: r.id,
      title: r.title,
      specialization: r.specialization,
      issueDate: r.issueDate,
      expiryDate: r.expiryDate,
      status: effectiveReferralStatus(r),
    })),
    attachments,
    counts: {
      visits: visits.filter((v) => v.status !== "PLANNED").length,
      examsDone: documents.filter((d) => d.status !== "PLANNED").length,
      examsPlanned: documents.filter((d) => d.status === "PLANNED").length,
      medications: medications.length,
    },
    leadDoctors,
    generatedAt: new Date(),
  };
}

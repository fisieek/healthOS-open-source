// Wspólne stałe dla modułu Wizyty/Badania wg części ciała.

export interface DictDoctor {
  id: string;
  name: string;
  specialization?: string | null;
}
export interface DictFacility {
  id: string;
  name: string;
}
export interface DictBodyPart {
  id: string;
  name: string;
  notes?: string | null;
}
export interface DictEpisode {
  id: string;
  bodyPartId: string;
  title: string;
  status: string;
  startDate: string;
  endDate?: string | null;
}
/**
 * Wizyta w postaci „słownikowej" — komplet wizyt użytkownika trafia do formularzy,
 * żeby `ExamFormModal` mógł sam wyliczyć listę „Podepnij do wizyty" i reagować
 * na zmianę części ciała / epizodu w otwartym formularzu.
 */
export interface DictVisit {
  id: string;
  /** Data właściwa (dla DONE) — ISO. */
  date: string;
  /** Planowany termin (dla PLANNED) — ISO albo null = termin nieustalony. */
  plannedDate: string | null;
  status: string;
  doctorName: string;
  specialization: string | null;
  bodyPartId: string | null;
  episodeId: string | null;
}
export interface Dictionaries {
  doctors: DictDoctor[];
  facilities: DictFacility[];
  bodyParts: DictBodyPart[];
  episodes: DictEpisode[];
  visits: DictVisit[];
}

// Popularne specjalizacje lekarskie (PL). Słownik startowy — użytkownik może
// dopisać własne (pole jest comboboxem z datalist, nie zamkniętą listą).
export const MEDICAL_SPECIALTIES: string[] = [
  "Alergolog",
  "Anestezjolog",
  "Angiolog",
  "Audiolog",
  "Chirurg ogólny",
  "Chirurg naczyniowy",
  "Chirurg onkologiczny",
  "Chirurg plastyczny",
  "Chirurg szczękowo-twarzowy",
  "Dermatolog",
  "Diabetolog",
  "Dietetyk",
  "Endokrynolog",
  "Fizjoterapeuta",
  "Foniatra",
  "Gastroenterolog",
  "Geriatra",
  "Ginekolog",
  "Hematolog",
  "Hepatolog",
  "Hipertensjolog",
  "Immunolog",
  "Internista",
  "Kardiolog",
  "Kardiochirurg",
  "Laryngolog (Otolaryngolog)",
  "Lekarz rodzinny / POZ",
  "Logopeda",
  "Medycyna pracy",
  "Nefrolog",
  "Neonatolog",
  "Neurochirurg",
  "Neurolog",
  "Okulista",
  "Onkolog",
  "Ortopeda (traumatolog)",
  "Pediatra",
  "Proktolog",
  "Psychiatra",
  "Psycholog",
  "Pulmonolog",
  "Radiolog",
  "Rehabilitant / Rehabilitacja medyczna",
  "Reumatolog",
  "Seksuolog",
  "Stomatolog",
  "Toksykolog",
  "Urolog",
  "Wenerolog",
];

export const EXAM_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "BLOOD_TEST", label: "Badanie krwi" },
  { value: "HORMONES", label: "Hormony" },
  { value: "IMAGING", label: "Obrazowanie (USG/RTG/MRI/TK)" },
  { value: "URINE_TEST", label: "Badanie moczu" },
  { value: "GENETIC", label: "Genetyka" },
  { value: "OTHER", label: "Inne" },
];

// Metody obrazowania — zapisywane w `HealthDocument.tags[0]`, wyświetlane jako badge.
export const IMAGING_MODALITIES: string[] = ["USG", "RTG", "MRI", "TK"];

export const EXAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

export function examTypeLabel(type: string): string {
  return EXAM_TYPE_LABELS[type] ?? type;
}

// Wspólny styl inputów (ciemny motyw)
export const INPUT_CLS =
  "w-full rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50";

// ─── Statusy wizyt ──────────────────────────────────────────────────────────────

export type VisitStatus = "PLANNED" | "DONE" | "CANCELLED";

export const VISIT_STATUS_OPTIONS: { value: VisitStatus; label: string }[] = [
  { value: "PLANNED", label: "Zaplanowane" },
  { value: "DONE", label: "Wykonane" },
  { value: "CANCELLED", label: "Anulowane" },
];

export const VISIT_STATUS_META: Record<
  VisitStatus,
  { label: string; badge: string }
> = {
  PLANNED: {
    label: "Zaplanowane",
    badge: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
  },
  DONE: {
    label: "Wykonane",
    badge: "bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/30",
  },
  CANCELLED: {
    label: "Anulowane",
    badge: "bg-rose-500/10 text-rose-300 border border-rose-500/30 line-through",
  },
};

export function visitStatusMeta(status?: string | null) {
  return VISIT_STATUS_META[(status as VisitStatus) ?? "DONE"] ?? VISIT_STATUS_META.DONE;
}

// ─── Statusy epizodów leczenia ──────────────────────────────────────────────────

export type EpisodeStatus = "ACTIVE" | "MONITORING" | "RESOLVED";

export const EPISODE_STATUS_OPTIONS: { value: EpisodeStatus; label: string }[] = [
  { value: "ACTIVE", label: "W trakcie leczenia" },
  { value: "MONITORING", label: "Pod obserwacją" },
  { value: "RESOLVED", label: "Zakończone" },
];

export const EPISODE_STATUS_META: Record<
  EpisodeStatus,
  { label: string; badge: string }
> = {
  ACTIVE: {
    label: "W trakcie",
    badge: "bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/30",
  },
  MONITORING: {
    label: "Obserwacja",
    badge: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
  },
  RESOLVED: {
    label: "Zakończone",
    badge: "bg-[#2e3229] text-[#8c9282] border border-[#3d4237]",
  },
};

export function episodeStatusMeta(status?: string | null) {
  return (
    EPISODE_STATUS_META[(status as EpisodeStatus) ?? "ACTIVE"] ??
    EPISODE_STATUS_META.ACTIVE
  );
}

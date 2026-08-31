"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  User,
  MapPin,
  Calendar,
  FlaskConical,
  FileText,
  ExternalLink,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  Link2,
  Flag,
  Activity,
  FileOutput,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VisitFormModal } from "./visit-form-modal";
import { ExamFormModal } from "./exam-form-modal";
import { formatVisitDate } from "@/lib/services/visit-dates";
import { EpisodeFormModal, type EpisodeRow } from "./episode-form-modal";
import { AttachRecordsModal } from "./attach-records-modal";
import { ReportOptionsModal } from "./report-options-modal";
import {
  examTypeLabel,
  visitStatusMeta,
  episodeStatusMeta,
  type Dictionaries,
} from "./constants";

interface VisitRow {
  id: string;
  date: string;
  plannedDate: string | null;
  status: string;
  doctorName: string;
  specialization: string;
  facility: string | null;
  reason: string;
  summary: string | null;
  recommendations: string | null;
  followUpDate: string | null;
  followUpNote: string | null;
  doctorRef: { id: string; name: string; specialization: string | null } | null;
  facilityRef: { id: string; name: string } | null;
  episodeId: string | null;
}

interface ExamRow {
  id: string;
  title: string;
  type: string;
  status: "PLANNED" | "DONE";
  studyDate: string;
  plannedDate: string | null;
  description: string | null;
  fileUrl: string | null;
  parameters: unknown;
  bodyPart: { id: string; name: string };
  orderingDoctor: { id: string; name: string; specialization: string | null } | null;
  performingDoctor: { id: string; name: string; specialization: string | null } | null;
  facilityRef: { id: string; name: string } | null;
  visitId: string | null;
  visit: { id: string; date: string } | null;
  episodeId: string | null;
}

/** Zabieg stomatologiczny podpięty do epizodu tej części ciała. */
interface DentalRow {
  id: string;
  toothNumber: number | null;
  procedure: string;
  status: string;
  date: string;
  plannedDate: string | null;
  notes: string | null;
  episodeId: string | null;
  dentistRef: { id: string; name: string } | null;
  facilityRef: { id: string; name: string } | null;
}

interface Props {
  bodyPart: { id: string; name: string; notes: string | null };
  /** Epizody leczenia tej części ciała (aktywne i zakończone). */
  episodes: EpisodeRow[];
  visits: VisitRow[];
  documents: ExamRow[];
  /** Zabiegi stomatologiczne — puste dla części ciała innych niż zęby/jama ustna. */
  dentalRecords?: DentalRow[];
  dictionaries: Dictionaries;
  /** Powrót do siatki części ciała (widok jest osadzony inline w zakładce). */
  onBack: () => void;
}

/** Filtr epizodu: wszystko / konkretny epizod / rekordy jeszcze nieprzypisane. */
type EpisodeFilter = "ALL" | "NONE" | string;

export function BodyPartDetailClient({
  bodyPart,
  episodes,
  visits,
  documents,
  dentalRecords = [],
  dictionaries,
  onBack,
}: Props) {
  const router = useRouter();
  const [grouping, setGrouping] = useState<"doctor" | "facility">("doctor");
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<VisitRow | null>(null);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editExam, setEditExam] = useState<ExamRow | null>(null);
  const [episodeFilter, setEpisodeFilter] = useState<EpisodeFilter>("ALL");
  /** Epizod, dla którego otwarto opcje raportu dla lekarza (poz. 10). */
  const [reportEpisode, setReportEpisode] = useState<EpisodeRow | null>(null);
  const [episodeModalOpen, setEpisodeModalOpen] = useState(false);
  const [editEpisode, setEditEpisode] = useState<EpisodeRow | null>(null);
  const [closingEpisode, setClosingEpisode] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  // Epizod, w którego kontekście działamy — nowe rekordy trafią od razu do niego.
  const activeEpisodeId =
    episodeFilter !== "ALL" && episodeFilter !== "NONE" ? episodeFilter : undefined;
  const selectedEpisode = episodes.find((e) => e.id === activeEpisodeId) ?? null;

  const matchesFilter = (episodeId: string | null) => {
    if (episodeFilter === "ALL") return true;
    if (episodeFilter === "NONE") return episodeId === null;
    return episodeId === episodeFilter;
  };

  const unassignedRecords =
    visits.filter((v) => v.episodeId === null).length +
    documents.filter((d) => d.episodeId === null).length;

  const shownVisits = useMemo(
    () => visits.filter((v) => matchesFilter(v.episodeId)),
    [visits, episodeFilter]
  );
  const shownDocuments = useMemo(
    () => documents.filter((d) => matchesFilter(d.episodeId)),
    [documents, episodeFilter]
  );
  const shownDental = useMemo(
    () => dentalRecords.filter((r) => matchesFilter(r.episodeId)),
    [dentalRecords, episodeFilter]
  );

  // Grupowanie wizyt
  const groupedVisits = useMemo(() => {
    const groups: Record<string, VisitRow[]> = {};
    for (const v of shownVisits) {
      const key =
        grouping === "doctor"
          ? v.doctorRef?.name || v.doctorName || "Bez lekarza"
          : v.facilityRef?.name || v.facility || "Bez placówki";
      (groups[key] ??= []).push(v);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], "pl"));
  }, [shownVisits, grouping]);

  const plannedExams = shownDocuments.filter((d) => d.status === "PLANNED");
  const doneExams = shownDocuments.filter((d) => d.status === "DONE");

  const openAddExam = () => {
    setEditExam(null);
    setExamModalOpen(true);
  };
  const openEditExam = (exam: ExamRow) => {
    setEditExam(exam);
    setExamModalOpen(true);
  };

  const deleteExam = async (id: string) => {
    if (!confirm("Usunąć to badanie?")) return;
    const res = await fetch(`/api/health/documents/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  };

  const openAddEpisode = () => {
    setEditEpisode(null);
    setClosingEpisode(false);
    setEpisodeModalOpen(true);
  };
  const openEditEpisode = (episode: EpisodeRow) => {
    setEditEpisode(episode);
    setClosingEpisode(false);
    setEpisodeModalOpen(true);
  };
  const openCloseEpisode = (episode: EpisodeRow) => {
    setEditEpisode(episode);
    setClosingEpisode(true);
    setEpisodeModalOpen(true);
  };

  const openAddVisit = () => {
    setEditVisit(null);
    setVisitModalOpen(true);
  };
  const openEditVisit = (visit: VisitRow) => {
    setEditVisit(visit);
    setVisitModalOpen(true);
  };

  const deleteVisit = async (id: string) => {
    if (!confirm("Usunąć tę wizytę?")) return;
    const res = await fetch(`/api/health/visits/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2e3229] pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5d6050] hover:text-[#8c9282] mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Wizyty lekarskie
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-[#f1f2ec]">{bodyPart.name}</h1>
          <p className="text-sm text-[#8c9282] mt-1">
            {shownVisits.length} wizyt · {plannedExams.length} badań do zrobienia ·{" "}
            {doneExams.length} zrobionych
          </p>
          {bodyPart.notes && (
            <p className="text-xs text-[#8c9282] mt-1 italic">{bodyPart.notes}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setAttachOpen(true)}
            title="Przypisz już istniejące badania i wizyty do tej części ciała"
            className="flex items-center gap-2 rounded-xl border border-[#2e3229] bg-[#1a1c18] px-4 py-2.5 text-xs font-bold text-[#f1f2ec] hover:border-[#bce663]/40 transition-all"
          >
            <Link2 className="h-4 w-4" /> Podepnij istniejące
          </button>
          <button
            onClick={openAddVisit}
            className="flex items-center gap-2 rounded-xl border border-[#2e3229] bg-[#1a1c18] px-4 py-2.5 text-xs font-bold text-[#f1f2ec] hover:border-[#bce663]/40 transition-all"
          >
            <Plus className="h-4 w-4" /> Wizyta
          </button>
          <button
            onClick={openAddExam}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all"
          >
            <Plus className="h-4 w-4" /> Badanie
          </button>
        </div>
      </div>

      {/* SEKCJA: LECZENIE (EPIZODY) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-[#bce663]" />
            <h2 className="text-sm font-bold text-[#f1f2ec] uppercase tracking-wide">
              Leczenie
            </h2>
          </div>
          <button
            onClick={openAddEpisode}
            className="flex items-center gap-1.5 rounded-lg border border-[#2e3229] bg-[#1a1c18] px-3 py-1.5 text-xs font-bold text-[#f1f2ec] hover:border-[#bce663]/40 transition-all self-start"
          >
            <Plus className="h-3.5 w-3.5" /> Nowe leczenie
          </button>
        </div>

        {episodes.length === 0 ? (
          <div className="p-5 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
            Brak wyodrębnionego leczenia. Załóż je, żeby móc je później{" "}
            <strong className="text-[#f1f2ec] font-semibold">zakończyć</strong> — dzięki
            temu kolejny problem tej samej części ciała będzie osobnym wątkiem, a nie
            ciągiem dalszym starego.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEpisodeFilter("ALL")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
                episodeFilter === "ALL"
                  ? "bg-[#bce663] text-[#0d0e0c] border-[#bce663]"
                  : "bg-[#1a1c18] border-[#2e3229] text-[#8c9282] hover:text-[#f1f2ec]"
              }`}
            >
              Wszystko
            </button>

            {episodes.map((e) => {
              const meta = episodeStatusMeta(e.status);
              const isSelected = episodeFilter === e.id;
              const isResolved = e.status === "RESOLVED";
              return (
                <div
                  key={e.id}
                  className={`flex items-center gap-1 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-[#bce663]/10 border-[#bce663]/50"
                      : "bg-[#1a1c18] border-[#2e3229]"
                  } ${isResolved && !isSelected ? "opacity-60" : ""}`}
                >
                  <button
                    onClick={() => setEpisodeFilter(e.id)}
                    className="flex flex-col items-start px-3 py-1.5 text-left"
                  >
                    <span
                      className={`text-xs font-semibold ${
                        isResolved ? "text-[#8c9282]" : "text-[#f1f2ec]"
                      }`}
                    >
                      {e.title}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-[#5d6050] font-mono">
                      <span className={`rounded px-1.5 py-0.5 ${meta.badge}`}>
                        {meta.label}
                      </span>
                      {isResolved && e.endDate
                        ? `do ${format(new Date(e.endDate), "dd.MM.yyyy")}`
                        : `od ${format(new Date(e.startDate), "dd.MM.yyyy")}`}
                    </span>
                  </button>
                  <div className="flex items-center pr-1.5 gap-0.5">
                    {!isResolved && (
                      <button
                        onClick={() => openCloseEpisode(e)}
                        title="Zakończ leczenie"
                        className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#bce663]/10 hover:text-[#bce663]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setReportEpisode(e)}
                      title="Eksportuj dla lekarza"
                      className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white"
                    >
                      <FileOutput className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEditEpisode(e)}
                      title="Edytuj leczenie"
                      className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {unassignedRecords > 0 && (
              <button
                onClick={() => setEpisodeFilter("NONE")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
                  episodeFilter === "NONE"
                    ? "bg-amber-500/20 text-amber-200 border-amber-500/50"
                    : "bg-[#1a1c18] border-[#2e3229] text-amber-300/70 hover:text-amber-300"
                }`}
              >
                Bez leczenia ({unassignedRecords})
              </button>
            )}
          </div>
        )}

        {selectedEpisode?.outcome && (
          <p className="text-xs text-[#8c9282] italic">
            Efekt: {selectedEpisode.outcome}
          </p>
        )}
        {selectedEpisode?.notes && (
          <p className="text-xs text-[#8c9282] whitespace-pre-wrap">
            {selectedEpisode.notes}
          </p>
        )}
      </section>

      {/* SEKCJA: BADANIA */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[#bce663]" />
          <h2 className="text-sm font-bold text-[#f1f2ec] uppercase tracking-wide">Badania</h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
            Brak badań. Dodaj badanie do zrobienia lub już wykonane.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#2e3229] bg-[#1a1c18]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2e3229] text-[10px] uppercase tracking-wide text-[#8c9282]">
                  <th className="px-4 py-3 font-bold">Badanie</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Kto zlecił</th>
                  <th className="px-4 py-3 font-bold">Kto wykonał</th>
                  <th className="px-4 py-3 font-bold">Data</th>
                  <th className="px-4 py-3 font-bold">Wynik</th>
                  <th className="px-4 py-3 font-bold text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {[...plannedExams, ...doneExams].map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[#2e3229]/60 last:border-0 hover:bg-[#0d0e0c]/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#f1f2ec]">{d.title}</p>
                      <p className="text-[10px] text-[#8c9282]">{examTypeLabel(d.type)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {d.status === "PLANNED" ? (
                        <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] gap-1">
                          <Clock className="h-3 w-3" /> Do zrobienia
                        </Badge>
                      ) : (
                        <Badge className="bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/30 text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Zrobione
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#8c9282]">
                      {d.orderingDoctor?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#8c9282]">
                      {d.performingDoctor?.name || d.facilityRef?.name || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#8c9282] whitespace-nowrap">
                      {d.status === "PLANNED"
                        ? d.plannedDate
                          ? format(new Date(d.plannedDate), "dd.MM.yyyy")
                          : "—"
                        : format(new Date(d.studyDate), "dd.MM.yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      {d.fileUrl ? (
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#bce663] hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> Plik
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : d.description ? (
                        <span className="text-[#8c9282] line-clamp-1 max-w-[160px] inline-block">
                          {d.description}
                        </span>
                      ) : (
                        <span className="text-[#5d6050]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {d.status === "PLANNED" && (
                          <button
                            onClick={() => openEditExam(d)}
                            title="Oznacz jako zrobione / uzupełnij wynik"
                            className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#bce663]/10 hover:text-[#bce663]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditExam(d)}
                          title="Edytuj"
                          className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteExam(d.id)}
                          title="Usuń"
                          className="rounded-lg p-1.5 text-[#8c9282] hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SEKCJA: ZABIEGI STOMATOLOGICZNE.
          Pokazywana tylko gdy epizod tej części ciała ma jakieś zabiegi —
          leczenie kanałowe to jeden wątek: wizyta → RTG → zabieg → kontrola. */}
      {shownDental.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#bce663]" />
            <h2 className="text-sm font-bold text-[#f1f2ec] uppercase tracking-wide">
              Zabiegi stomatologiczne
            </h2>
          </div>
          <div className="space-y-2">
            {shownDental.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-[#2e3229] bg-[#1a1c18] p-3 flex justify-between items-start gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-[#bce663]/10 text-[#bce663] text-[10px] font-mono capitalize">
                      {r.procedure}
                    </Badge>
                    {r.toothNumber !== null && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0d0e0c] border border-[#2e3229] text-[#8c9282]">
                        ząb #{r.toothNumber}
                      </span>
                    )}
                    {r.status === "PLANNED" && (
                      <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] gap-1">
                        <Clock className="h-3 w-3" /> Umówiony
                      </Badge>
                    )}
                  </div>
                  {r.dentistRef?.name && (
                    <p className="text-xs text-[#8c9282] mt-1">
                      {r.dentistRef.name}
                      {r.facilityRef?.name ? ` · ${r.facilityRef.name}` : ""}
                    </p>
                  )}
                  {r.notes && (
                    <p className="text-[11px] text-[#8c9282] mt-1 italic">{r.notes}</p>
                  )}
                </div>
                <span className="text-[11px] text-[#8c9282] font-mono shrink-0">
                  {r.status === "PLANNED"
                    ? r.plannedDate
                      ? format(new Date(r.plannedDate), "dd.MM.yyyy")
                      : "Termin nieustalony"
                    : format(new Date(r.date), "dd.MM.yyyy")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SEKCJA: WIZYTY (grupowane) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#bce663]" />
            <h2 className="text-sm font-bold text-[#f1f2ec] uppercase tracking-wide">Wizyty</h2>
          </div>
          <div className="flex gap-1 bg-[#1a1c18] p-1 rounded-lg border border-[#2e3229] self-start">
            {(
              [
                ["doctor", "Wg lekarza"],
                ["facility", "Wg placówki"],
              ] as [typeof grouping, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setGrouping(key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  grouping === key
                    ? "bg-[#bce663] text-[#0d0e0c]"
                    : "text-[#8c9282] hover:text-[#f1f2ec]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visits.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
            Brak wizyt dla tej części ciała.
          </div>
        ) : (
          <div className="space-y-5">
            {groupedVisits.map(([groupName, groupVisits]) => (
              <div key={groupName} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#f1f2ec]">
                  {grouping === "doctor" ? (
                    <User className="h-3.5 w-3.5 text-[#8c9282]" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 text-[#8c9282]" />
                  )}
                  {groupName}
                  <span className="text-[10px] font-normal text-[#5d6050]">
                    ({groupVisits.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupVisits.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-xl border border-[#2e3229] bg-[#1a1c18] p-4 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-[#bce663]/10 text-[#bce663] text-[10px] uppercase font-bold tracking-wider">
                              {v.specialization}
                            </Badge>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${visitStatusMeta(v.status).badge}`}
                            >
                              {visitStatusMeta(v.status).label}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#f1f2ec] flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-[#8c9282]" /> {v.doctorName}
                          </p>
                          {grouping === "doctor" && v.facility && (
                            <p className="text-[11px] text-[#8c9282] flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {v.facility}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-[#8c9282] font-mono flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-[#bce663]" />
                            {formatVisitDate(v)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => openEditVisit(v)}
                              title="Edytuj wizytę"
                              className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteVisit(v.id)}
                              title="Usuń wizytę"
                              className="rounded-lg p-1.5 text-[#8c9282] hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      {v.summary && (
                        <p className="text-xs text-[#8c9282] whitespace-pre-wrap">{v.summary}</p>
                      )}
                      {v.recommendations && (
                        <div className="bg-[#0d0e0c] p-2 rounded-lg border border-[#2e3229]">
                          <p className="text-[10px] uppercase font-bold tracking-wide text-[#bce663]">
                            Zalecenia
                          </p>
                          <p className="text-xs text-[#f1f2ec] mt-0.5 whitespace-pre-wrap">
                            {v.recommendations}
                          </p>
                        </div>
                      )}
                      {v.followUpDate && (
                        <div className="text-[11px] text-[#bce663] bg-[#bce663]/5 p-1.5 rounded-lg border border-[#bce663]/20 flex justify-between">
                          <span className="font-semibold">Kontrola:</span>
                          <span className="font-mono">
                            {format(new Date(v.followUpDate), "dd.MM.yyyy")}
                            {v.followUpNote ? ` (${v.followUpNote})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODALE */}
      <VisitFormModal
        key={`visit-${visitModalOpen ? "open" : "closed"}-${editVisit?.id ?? "new"}`}
        open={visitModalOpen}
        onClose={() => {
          setVisitModalOpen(false);
          setEditVisit(null);
        }}
        dictionaries={dictionaries}
        presetBodyPart={bodyPart.name}
        presetEpisodeId={activeEpisodeId}
        editVisit={editVisit}
        onCreated={() => router.refresh()}
      />
      <ExamFormModal
        key={`exam-${examModalOpen ? "open" : "closed"}-${editExam?.id ?? "new"}`}
        open={examModalOpen}
        onClose={() => {
          setExamModalOpen(false);
          setEditExam(null);
        }}
        dictionaries={dictionaries}
        presetBodyPart={bodyPart.name}
        presetEpisodeId={activeEpisodeId}
        editExam={editExam}
        onSaved={() => router.refresh()}
      />
      <EpisodeFormModal
        key={`ep-${episodeModalOpen ? "open" : "closed"}-${editEpisode?.id ?? "new"}-${closingEpisode ? "close" : "edit"}`}
        open={episodeModalOpen}
        onClose={() => {
          setEpisodeModalOpen(false);
          setEditEpisode(null);
          setClosingEpisode(false);
        }}
        bodyPartId={bodyPart.id}
        bodyPartName={bodyPart.name}
        editEpisode={editEpisode}
        closing={closingEpisode}
        onSaved={() => router.refresh()}
      />
      {reportEpisode && (
        <ReportOptionsModal
          open
          onClose={() => setReportEpisode(null)}
          episodeId={reportEpisode.id}
          episodeTitle={reportEpisode.title}
        />
      )}

      <AttachRecordsModal
        key={`attach-${attachOpen ? "open" : "closed"}`}
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        bodyPartId={bodyPart.id}
        bodyPartName={bodyPart.name}
        episodes={episodes}
        presetEpisodeId={activeEpisodeId}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

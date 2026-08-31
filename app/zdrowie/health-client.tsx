"use client";

import { useState, useRef, useMemo } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar, User, MapPin, Activity, CheckCircle, Plus, Trash2,
  Image as ImageIcon, FlaskConical, Bell, Sparkles, FileText, Download, ExternalLink,
  ChevronDown, ChevronUp, Moon, Heart, Brain, Zap, Trophy,
  Stethoscope, ChevronRight, ClipboardList, Pencil, Link2, BookMarked
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BodyPartDetailClient } from "./wizyty/body-part-detail-client";
import { ExamFormModal } from "./wizyty/exam-form-modal";
import { VisitFormModal } from "./wizyty/visit-form-modal";
import { BodyPartFormModal } from "./wizyty/body-part-form-modal";
import { DentalFormModal } from "./wizyty/dental-form-modal";
import { ReferralsCard } from "./wizyty/referrals-card";
import { AgendaPanel } from "./wizyty/agenda-panel";
import type { AgendaBuckets } from "@/lib/constants/agenda";
import {
  FollowUpModal,
  type FollowUpSuggestion,
} from "./wizyty/follow-up-modal";
import {
  AiSuggestionsPanel,
  countChanged,
  type AiSuggestions,
} from "./wizyty/ai-suggestions-panel";
import type { Dictionaries } from "./wizyty/constants";
import { MedicationManager, type MedicationManagerHandle } from "@/app/health/medications/medication-form";
import { DocumentsManager } from "@/app/health/documents/documents-manager";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend as RechartsLegend
} from "recharts";
import { calculateDailyHealthScore, getHealthScoreInterpretation } from "@/lib/services/health-score";
import { BIOMARKER_CATEGORIES, getBiomarkerCategory } from "@/lib/services/biomarker-categories";
import { AddDocumentModal } from "@/components/health-intake/add-document-modal";
import { SupplementManager } from "@/app/health/supplements/supplement-form";
import { NutrientIntakeSummary } from "./nutrients-summary";
import { TrainingAnalyticsTab } from "./training-tab";
import {
  WHOLE_MOUTH_PROCEDURES,
  procedureNeedsTooth,
  FDI_UPPER_RIGHT,
  FDI_UPPER_LEFT,
  FDI_LOWER_LEFT,
  FDI_LOWER_RIGHT,
} from "@/lib/constants/dental";
import {
  splitVisitsByDate,
  formatVisitDate,
} from "@/lib/services/visit-dates";

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1c18",
  borderColor: "#2e3229",
  borderRadius: "8px",
  color: "#f1f2ec",
  fontSize: "12px",
};

const LABEL_STYLE = {
  color: "#8c9282",
  fontWeight: "bold",
};


interface HealthClientProps {
  initialVisits: any[];
  initialDentalRecords: any[];
  initialMedications: any[];
  initialDocuments: any[];
  imagingDocs: any[];
  facilitySuggestions: string[];
  bloodMarkers?: any[];
  initialDailyMetrics?: any[];
  initialSleepSessions?: any[];
  initialSupplements?: any[];
  initialTodayIntakes?: any[];
  nutrients?: any[];
  activities?: any[];
  strengthWorkouts?: any[];
  initialReferrals?: any[];
  initialHealthEvents?: any[];
  userProfile?: { birthDate: string | null; sex: string | null } | null;
  bodyPartCards?: {
    id: string;
    name: string;
    notes: string | null;
    visitCount: number;
    plannedExams: number;
    doneExams: number;
    activeEpisodes: number;
    resolvedEpisodes: number;
  }[];
  unassignedExams?: number;
  bodyPartDetails?: Record<string, {
    bodyPart: { id: string; name: string; notes: string | null };
    episodes: any[];
    visits: any[];
    documents: any[];
    dentalRecords: any[];
  }>;
  dictionaries?: Dictionaries;
  /** „Co Cię czeka" — zaległe / nadchodzące / bez terminu (poz. 9 etap 1). */
  agenda?: AgendaBuckets;
  /** Z `?bodyPart=` — otwiera drill-down od razu (wejście z kalendarza). */
  initialBodyPartId?: string | null;
}

type Tab = "visits" | "dental" | "meds" | "imaging" | "docs" | "blood" | "daily" | "supplements" | "training" | "prevention";

type Section = "medical" | "daily";

// Podzakładki pogrupowane w dwie sekcje (kolejność ma znaczenie — pierwsza pozycja
// jest zakładką domyślną sekcji przy przełączeniu).
const MEDICAL_TABS: [Tab, string][] = [
  ["visits", "Wizyty lekarskie"],
  ["dental", "Stomatologia"],
  ["meds", "Leki"],
  ["imaging", "Badania RTG/USG"],
  ["blood", "Badania laboratoryjne"],
  ["docs", "Wyniki badań"],
  ["prevention", "Profilaktyka"],
];

const DAILY_TABS: [Tab, string][] = [
  ["supplements", "Suplementacja"],
  ["daily", "Dzienne wyniki"],
  ["training", "Wydolność i trening"],
];

const SECTIONS: [Section, string][] = [
  ["medical", "Dokumentacja medyczna"],
  ["daily", "Codzienne i trening"],
];

const SECTION_TABS: Record<Section, [Tab, string][]> = {
  medical: MEDICAL_TABS,
  daily: DAILY_TABS,
};

// Sekcja, do której należy dana zakładka (aktywna sekcja jest wyprowadzana z activeTab).
function sectionForTab(tab: Tab): Section {
  return DAILY_TABS.some(([key]) => key === tab) ? "daily" : "medical";
}

export function HealthClient({
  initialVisits,
  initialDentalRecords,
  initialMedications,
  initialDocuments,
  imagingDocs: initialImagingDocs,
  facilitySuggestions,
  bloodMarkers = [],
  initialDailyMetrics = [],
  initialSleepSessions = [],
  initialSupplements = [],
  initialTodayIntakes = [],
  nutrients = [],
  activities = [],
  strengthWorkouts = [],
  initialReferrals = [],
  initialHealthEvents = [],
  userProfile = null,
  bodyPartCards = [],
  unassignedExams = 0,
  bodyPartDetails = {},
  dictionaries,
  agenda,
  initialBodyPartId = null,
}: HealthClientProps) {
  const router = useRouter();
  // Zakładka startowa: dokumentacja medyczna. `activeSection` jest wyliczana
  // z `activeTab` przez sectionForTab(), więc ta jedna linia ustawia obie.
  // Podąża za MEDICAL_TABS[0], żeby nie rozjechać się przy zmianie kolejności zakładek.
  const [activeTab, setActiveTab] = useState<Tab>(MEDICAL_TABS[0][0]);
  // Zakładka „Wizyty lekarskie": widok wg części ciała / wszystkie wizyty + inline drill-down
  const [visitsView, setVisitsView] = useState<"byBodyPart" | "all">("byBodyPart");
  const [selectedBodyPartId, setSelectedBodyPartId] = useState<string | null>(
    initialBodyPartId
  );

  const [selectedMarker, setSelectedMarker] = useState<string | null>(() => {
    return bloodMarkers.length > 0 ? bloodMarkers[0].name : null;
  });
  const [biomarkerFilter, setBiomarkerFilter] = useState<string>("Wszystkie");

  const activeMarker = selectedMarker
    ? bloodMarkers.find((m) => m.name === selectedMarker)
    : null;

  // Refs do zewnętrznych managerów żeby otwierać formularze z nagłówka
  const medsRef = useRef<MedicationManagerHandle>(null);
  const supplementsRef = useRef<any>(null);

  // Modal state — generyczne
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [dentalModalOpen, setDentalModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);

  // Skierowania i szczepienia
  const [referrals, setReferrals] = useState(initialReferrals);
  const [healthEvents, setHealthEvents] = useState(initialHealthEvents);

  // Modale profilaktyki
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [vaccinationModalOpen, setVaccinationModalOpen] = useState(false);

  // Formularz skierowania
  const [refTitle, setRefTitle] = useState("");
  const [refSpecialization, setRefSpecialization] = useState("");
  const [refDoctorName, setRefDoctorName] = useState("");
  const [refIssueDate, setRefIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [refExpiryDate, setRefExpiryDate] = useState("");
  const [refCode, setRefCode] = useState("");
  const [refNotes, setRefNotes] = useState("");
  const [refLoading, setRefLoading] = useState(false);

  // Formularz szczepienia
  const [vacTitle, setVacTitle] = useState("");
  const [vacDate, setVacDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vacDescription, setVacDescription] = useState("");
  const [vacLoading, setVacLoading] = useState(false);

  // Wizyty
  const [visits, setVisits] = useState(initialVisits);

  // Stomatologia
  const [dentalRecords, setDentalRecords] = useState(initialDentalRecords);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  // Formularz zabiegu żyje w `DentalFormModal` — tutaj zostaje tylko to,
  // czym steruje mapa zębów i lista.
  const [editDental, setEditDental] = useState<any | null>(null);

  // Badania obrazowe (RTG/USG). Dodawanie i edycja idą przez wspólny `ExamFormModal`
  // — ten sam formularz, co w drill-downie części ciała, dzięki czemu badanie dodane
  // tutaj od razu ma „Powód/Część ciała" i nie ląduje jako osierocone.
  const [imagingDocs, setImagingDocs] = useState(initialImagingDocs);
  const [summarizingIds, setSummarizingIds] = useState<string[]>([]);
  // Sugestie AI per dokument. Trasa `summarize` nic nie zapisuje — trzymamy jej
  // odpowiedź tutaj, a do bazy trafia dopiero to, co user zaznaczy w panelu.
  // Stan jest ulotny (do odświeżenia strony); trwałe zapamiętanie odrzucenia
  // wymaga kolumny `HealthDocument.aiSuggestions` z poz. 5.
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiSuggestions>>({});
  /** Dokumenty, dla których panel sugestii jest rozwinięty. */
  const [openSuggestions, setOpenSuggestions] = useState<string[]>([]);
  /** Propozycja badania kontrolnego czekająca na decyzję (poz. 5). */
  const [followUp, setFollowUp] = useState<
    { documentId: string; suggestion: FollowUpSuggestion } | null
  >(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [bodyPartModalOpen, setBodyPartModalOpen] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editExam, setEditExam] = useState<any>(null);
  const [examPresetType, setExamPresetType] = useState<string | undefined>(undefined);

  const openAddExam = (presetType?: string) => {
    setEditExam(null);
    setExamPresetType(presetType);
    setExamModalOpen(true);
  };
  /** Badania (obrazowe i laboratoryjne) bez przypisanej części ciała. */
  const unassignedDocs = useMemo(
    () =>
      [...imagingDocs, ...initialDocuments].filter((d: any) => !d.bodyPartId),
    [imagingDocs, initialDocuments]
  );

  const openEditExam = (doc: any) => {
    setEditExam(doc);
    setExamPresetType(undefined);
    setExamModalOpen(true);
  };

  // Wizyty handlers
  const handleDeleteVisit = async (id: string) => {
    if (!confirm("Usunąć tę wizytę?")) return;
    try {
      const res = await fetch(`/api/health/visits/${id}`, { method: "DELETE" });
      if (res.ok) setVisits(visits.filter((v) => v.id !== id));
    } catch (err) { console.error(err); }
  };

  // Wizyty bez ustalonego terminu mają `date` = placeholder-dziś, więc w jednej
  // chronologii udawałyby dzisiejsze. Pokazujemy je w osobnej sekcji na dole.
  const { dated: datedVisits, undated: undatedVisits } = useMemo(
    () => splitVisitsByDate(visits),
    [visits]
  );

  const renderVisitCard = (visit: any) => (
              <Card key={visit.id} className="bg-[#1a1c18] border-[#2e3229] hover:border-[#bce663]/40 transition-all rounded-xl overflow-hidden flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30 flex flex-row justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className="bg-[#bce663]/10 text-[#bce663] text-[10px] uppercase font-bold tracking-wider">
                        {visit.specialization}
                      </Badge>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        visit.status === "PLANNED"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                          : visit.status === "CANCELLED"
                          ? "bg-rose-500/10 text-rose-300 border border-rose-500/30 line-through"
                          : "bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/30"
                      }`}>
                        {visit.status === "PLANNED" ? "Zaplanowane" : visit.status === "CANCELLED" ? "Anulowane" : "Wykonane"}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-[#f1f2ec] flex items-center gap-1.5">
                      <User className="h-4 w-4 text-[#8c9282]" /> {visit.doctorName}
                    </CardTitle>
                    {visit.facility && (
                      <p className="text-xs text-[#8c9282] flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {visit.facility}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className="text-xs text-[#8c9282] flex items-center gap-1 font-mono">
                      <Calendar className="h-3.5 w-3.5 text-[#bce663]" /> {formatVisitDate(visit)}
                    </span>
                    <Button
                      onClick={() => handleDeleteVisit(visit.id)}
                      className="bg-transparent hover:bg-rose-500/10 text-[#8c9282] hover:text-rose-400 p-1.5 h-auto"
                      title="Usuń wizytę"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3.5 flex-1">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">Powód wizyty</p>
                    <p className="text-xs text-[#f1f2ec] mt-0.5 font-medium">{visit.reason}</p>
                  </div>
                  {visit.summary && (
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">Diagnoza / Wnioski</p>
                      <p className="text-xs text-[#8c9282] mt-0.5 whitespace-pre-wrap">{visit.summary}</p>
                    </div>
                  )}
                  {visit.recommendations && (
                    <div className="bg-[#0d0e0c] p-3 rounded-lg border border-[#2e3229]">
                      <p className="text-[10px] uppercase font-bold tracking-wide text-[#bce663] flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Zalecenia lekarskie
                      </p>
                      <p className="text-xs text-[#f1f2ec] mt-1 whitespace-pre-wrap">{visit.recommendations}</p>
                    </div>
                  )}
                  {visit.followUpDate && (
                    <div className="text-xs text-[#bce663] bg-[#bce663]/5 p-2 rounded-lg border border-[#bce663]/20 flex justify-between items-center">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5" /> Kontrola:
                      </span>
                      <span className="font-mono">
                        {format(new Date(visit.followUpDate), "dd.MM.yyyy")}
                        {visit.followUpNote ? ` (${visit.followUpNote})` : ""}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
  );

  // Stomatologia handlers

  /** Zapis z `DentalFormModal` — obsługuje i dodanie, i edycję zabiegu. */
  const handleDentalSaved = (record: any) => {
    setDentalRecords((prev: any[]) => {
      const idx = prev.findIndex((r) => r.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
    setEditDental(null);
    // Odświeżenie danych serwerowych — słowniki i epizody mogły się zmienić.
    router.refresh();
  };

  const openEditDental = (record: any) => {
    setEditDental(record);
    setDentalModalOpen(true);
  };

  const handleDeleteDentalRecord = async (id: string) => {
    if (!confirm("Usunąć ten zabieg?")) return;
    try {
      const res = await fetch(`/api/health/dental/${id}`, { method: "DELETE" });
      if (res.ok) setDentalRecords(dentalRecords.filter((r) => r.id !== id));
    } catch (err) { console.error(err); }
  };

  // Badania obrazowe handlers (RTG/USG)

  /**
   * Analiza AI świeżo dodanego pliku. Po zmianie kontraktu trasy **tylko liczy
   * sugestie** — karta pokazuje plakietkę „AI ma N sugestii", a zapis następuje
   * wyłącznie po kliknięciu użytkownika w panelu.
   */
  const summarizeInBackground = (doc: any) => {
    if (!doc?.fileUrl) return;
    setSummarizingIds((prev) => [...prev, doc.id]);
    fetch(`/api/health/documents/${doc.id}/summarize`, { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error("Błąd podsumowania");
        return r.json();
      })
      .then((res) => {
        if (res?.suggestions) {
          setAiSuggestions((prev) => ({ ...prev, [doc.id]: res.suggestions }));
        }
        // Kontrola zalecona w opisie — pytamy, ale dopiero po wyraźnym kliknięciu
        // użytkownika w karcie; automat po uploadzie tylko odnotowuje sugestię.
        if (res?.followUp?.recommended && !res.followUp.dismissed) {
          setFollowUp({ documentId: doc.id, suggestion: res.followUp });
        }
      })
      .catch((err) => console.error("Podsumowanie AI nie powiodło się:", err))
      .finally(() => {
        setSummarizingIds((prev) => prev.filter((id) => id !== doc.id));
      });
  };

  /** Zapis z `ExamFormModal` — obsługuje i dodanie, i edycję badania. */
  const handleExamSaved = (doc: any) => {
    const isEdit = imagingDocs.some((d) => d.id === doc.id);
    if (isEdit) {
      setImagingDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, ...doc } : d))
      );
    } else {
      setImagingDocs((prev) => [doc, ...prev]);
      summarizeInBackground(doc);
    }
    // Odświeżenie danych serwerowych — liczniki części ciała, epizody, słowniki.
    router.refresh();
  };

  const handleDeleteImaging = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to badanie obrazowe wraz z plikiem?")) return;
    try {
      const res = await fetch(`/api/health/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setImagingDocs(imagingDocs.filter((d) => d.id !== id));
      }
    } catch (err) { console.error(err); }
  };

  /** „Przeanalizuj AI" — pobiera sugestie i rozwija panel do zatwierdzenia. */
  const handleTriggerAI = async (id: string) => {
    if (summarizingIds.includes(id)) return;
    setSummarizingIds((prev) => [...prev, id]);
    try {
      const res = await fetch(`/api/health/documents/${id}/summarize`, { method: "POST" });
      if (!res.ok) throw new Error("Błąd podsumowania");
      const data = await res.json();
      if (data?.suggestions) {
        setAiSuggestions((prev) => ({ ...prev, [id]: data.suggestions }));
        setOpenSuggestions((prev) => (prev.includes(id) ? prev : [...prev, id]));
      }
      if (data?.followUp?.recommended && !data.followUp.dismissed) {
        setFollowUp({ documentId: id, suggestion: data.followUp });
      }
    } catch (err) {
      console.error("Analiza AI nie powiodła się:", err);
    } finally {
      setSummarizingIds((prev) => prev.filter((item) => item !== id));
    }
  };

  /** Użytkownik zatwierdził część sugestii — dokument wraca z PATCH-a. */
  const handleSuggestionsApplied = (doc: any) => {
    setImagingDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)));
    dismissSuggestions(doc.id);
    router.refresh();
  };

  const dismissSuggestions = (id: string) => {
    setOpenSuggestions((prev) => prev.filter((item) => item !== id));
    setAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Skierowania handlers
  const resetReferralForm = () => {
    setRefTitle("");
    setRefSpecialization("");
    setRefDoctorName("");
    setRefIssueDate(format(new Date(), "yyyy-MM-dd"));
    setRefExpiryDate("");
    setRefCode("");
    setRefNotes("");
  };

  const handleAddReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refTitle.trim() || !refSpecialization.trim() || !refIssueDate) return;
    setRefLoading(true);
    try {
      const res = await fetch("/api/health/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: refTitle.trim(),
          specialization: refSpecialization.trim(),
          doctorName: refDoctorName.trim() || null,
          issueDate: refIssueDate,
          expiryDate: refExpiryDate || null,
          code: refCode.trim() || null,
          notes: refNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const newRef = await res.json();
        setReferrals([newRef, ...referrals]);
        setReferralModalOpen(false);
        resetReferralForm();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefLoading(false);
    }
  };

  // Szczepienia handlers
  const resetVaccinationForm = () => {
    setVacTitle("");
    setVacDate(format(new Date(), "yyyy-MM-dd"));
    setVacDescription("");
  };

  const handleAddVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacTitle.trim() || !vacDate) return;
    setVacLoading(true);
    try {
      const res = await fetch("/api/health/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "VACCINATION",
          title: vacTitle.trim(),
          date: vacDate,
          description: vacDescription.trim() || null,
        }),
      });
      if (res.ok) {
        const newEvent = await res.json();
        setHealthEvents([newEvent, ...healthEvents]);
        setVaccinationModalOpen(false);
        resetVaccinationForm();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVacLoading(false);
    }
  };

  const handleDeleteVaccination = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to szczepienie?")) return;
    try {
      const res = await fetch(`/api/health/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        setHealthEvents(healthEvents.filter((e: any) => e.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Tooth color
  const getToothColor = (toothNum: number) => {
    const records = dentalRecords.filter((r) => r.toothNumber === toothNum);
    if (records.length === 0) return "bg-[#1a1c18] hover:bg-[#2e3229]/60 border-[#2e3229] text-[#8c9282]";
    const latest = records[0];
    if (latest.procedure === "usuwanie" || latest.procedure === "brak") {
      return "bg-zinc-800 border-zinc-700 opacity-40 text-zinc-600";
    }
    if (latest.procedure === "leczenie kanałowe") {
      return "bg-sky-950 border-sky-500 text-sky-400 font-bold";
    }
    if (latest.procedure === "implant" || latest.procedure === "korona") {
      return "bg-yellow-950 border-yellow-500 text-yellow-400 font-bold";
    }
    return "bg-emerald-950 border-emerald-500 text-emerald-400 font-bold";
  };

  // Header action button — dynamiczny zależnie od zakładki
  const renderHeaderAction = () => {
    switch (activeTab) {
      case "visits":
        return (
          <button
            onClick={() => setVisitModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        );
      case "dental":
        return (
          <button
            onClick={() => setDentalModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        );
      case "meds":
        return (
          <button
            onClick={() => medsRef.current?.openForm()}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        );
      case "imaging":
        return (
          <button
            onClick={() => openAddExam("IMAGING")}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        );
      case "docs":
        return (
          <button
            onClick={() => setDocumentModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        );
      case "blood":
        return (
          <button
            onClick={() => setDocumentModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj
          </button>
        );
      case "supplements":
        return (
          <button
            onClick={() => supplementsRef.current?.openAddForm()}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj suplement
          </button>
        );
      default:
        return null;
    }
  };

  // Tooth row component
  const ToothRow = ({ teeth }: { teeth: number[] }) => (
    <div className="flex justify-center gap-1.5">
      {teeth.map((num, idx) => {
        // Insert midline gap between quadrants (after position 8 of first quadrant)
        const isMidline = idx === 8;
        return (
          <span key={num} className="contents">
            {isMidline && <span className="w-2" />}
            <button
              onClick={() => setSelectedTooth(selectedTooth === num ? null : num)}
              className={`aspect-square w-9 sm:w-10 border-2 rounded-lg flex flex-col justify-center items-center text-xs font-mono transition-all ${getToothColor(num)} ${selectedTooth === num ? "ring-2 ring-[#bce663] scale-110 border-[#bce663]" : ""
                }`}
              title={`FDI ${num}`}
            >
              <span className="font-bold text-sm leading-none">{num}</span>
            </button>
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK */}
      <div className="border-b border-[#2e3229] pb-5 space-y-4">
        {/* Tytuł + akcja */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-[10px] font-mono text-[#5d6050] mb-1">HealthOS / Zdrowie</p>
            <h1 className="text-2xl font-bold tracking-tight text-[#f1f2ec]">Zdrowie</h1>
            <p className="text-sm text-[#8c9282] mt-1">
              Wizyty lekarskie, stomatologia, leki i archiwum badań medycznych.
            </p>
          </div>

          {/* Header action button — dynamiczny (sam po prawej, zawsze w całości widoczny) */}
          {renderHeaderAction()}
        </div>

        {/* Nawigacja: nadrzędny przełącznik sekcji + podzakładki aktywnej sekcji */}
        {(() => {
          const activeSection = sectionForTab(activeTab);
          const sectionLabel = SECTIONS.find(([key]) => key === activeSection)?.[1] ?? "";
          return (
            <div className="space-y-3">
              {/* Przełącznik sekcji */}
              <div className="flex flex-wrap gap-1 bg-[#1a1c18] p-1 rounded-xl border border-[#2e3229] w-fit">
                {SECTIONS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(SECTION_TABS[key][0][0])}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${activeSection === key
                      ? "bg-[#bce663] text-[#0d0e0c]"
                      : "text-[#8c9282] hover:text-[#f1f2ec]"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Etykieta aktywnej sekcji */}
              <p className="text-[10px] font-mono text-[#5d6050] uppercase tracking-wider">
                {sectionLabel}
              </p>

              {/* Podzakładki aktywnej sekcji */}
              <div className="flex flex-wrap gap-1 bg-[#1a1c18] p-1 rounded-xl border border-[#2e3229] w-fit">
                {SECTION_TABS[activeSection].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${activeTab === key
                      ? "bg-[#bce663] text-[#0d0e0c]"
                      : "text-[#8c9282] hover:text-[#f1f2ec]"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 0. DZIENNE WYNIKI */}
      {activeTab === "daily" && (
        <DailyMetricsTab dailyMetrics={initialDailyMetrics} sleepSessions={initialSleepSessions} />
      )}

      {/* 1. WIZYTY */}
      {activeTab === "visits" && (
        <div className="space-y-6">
          {/* Szczegóły części ciała (inline) albo przełącznik widoku + listy wizyt */}
          {selectedBodyPartId && bodyPartDetails[selectedBodyPartId] ? (
            <BodyPartDetailClient
              bodyPart={bodyPartDetails[selectedBodyPartId].bodyPart}
              episodes={bodyPartDetails[selectedBodyPartId].episodes}
              visits={bodyPartDetails[selectedBodyPartId].visits}
              documents={bodyPartDetails[selectedBodyPartId].documents}
              dentalRecords={bodyPartDetails[selectedBodyPartId].dentalRecords}
              dictionaries={dictionaries!}
              onBack={() => setSelectedBodyPartId(null)}
            />
          ) : (
            <>
              {/* Panel „co Cię czeka" — nad przełącznikiem widoku, bo odpowiada
                  na pytanie zadawane najczęściej (poz. 9 etap 1). */}
              {agenda && (
                <AgendaPanel
                  agenda={agenda}
                  onOpenBodyPart={(id) => setSelectedBodyPartId(id)}
                />
              )}

              {/* Przełącznik widoku + akcje na słownikach */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap gap-1 bg-[#1a1c18] p-1 rounded-xl border border-[#2e3229] w-fit">
                {([["byBodyPart", "Wg części ciała"], ["all", "Wszystkie wizyty"]] as [typeof visitsView, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setVisitsView(key); setShowUnassigned(false); }}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${visitsView === key ? "bg-[#bce663] text-[#0d0e0c]" : "text-[#8c9282] hover:text-[#f1f2ec]"}`}
                  >
                    {label}
                  </button>
                ))}
                </div>

                {visitsView === "byBodyPart" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setBodyPartModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl border border-[#2e3229] bg-[#1a1c18] px-4 py-2.5 text-xs font-bold text-[#f1f2ec] hover:border-[#bce663]/40 transition-all"
                    >
                      <Plus className="h-4 w-4" /> Nowa część ciała / leczenie
                    </button>
                    <Link
                      href="/zdrowie/slowniki"
                      className="flex items-center gap-2 rounded-xl border border-[#2e3229] bg-[#1a1c18] px-4 py-2.5 text-xs font-bold text-[#8c9282] hover:text-[#f1f2ec] hover:border-[#bce663]/40 transition-all"
                    >
                      <BookMarked className="h-4 w-4" /> Słowniki
                    </Link>
                  </div>
                )}
              </div>

              {/* WIDOK: WG CZĘŚCI CIAŁA */}
              {visitsView === "byBodyPart" && (
                <div className="space-y-4">
                  {bodyPartCards.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
                      Brak części ciała. Dodaj wizytę i wpisz „Powód/Część ciała" (np. Tarczyca) — utworzy się automatycznie.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bodyPartCards.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBodyPartId(b.id)}
                          className="group text-left rounded-xl border border-[#2e3229] bg-[#1a1c18] p-5 hover:border-[#bce663]/40 transition-all flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 rounded-lg bg-[#bce663]/10 flex items-center justify-center">
                                <Stethoscope className="h-4 w-4 text-[#bce663]" />
                              </div>
                              <h3 className="text-base font-bold text-[#f1f2ec]">{b.name}</h3>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[#5d6050] group-hover:text-[#bce663] transition-colors" />
                          </div>
                          {b.notes && <p className="text-xs text-[#8c9282] mt-2 line-clamp-2">{b.notes}</p>}
                          <div className="flex flex-wrap gap-2 mt-4">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#0d0e0c] border border-[#2e3229] px-2 py-1 text-[11px] text-[#8c9282]">
                              <ClipboardList className="h-3 w-3" /> {b.visitCount} wizyt
                            </span>
                            {b.plannedExams > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-[11px] text-amber-300">
                                <FlaskConical className="h-3 w-3" /> {b.plannedExams} do zrobienia
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[#bce663]/10 border border-[#bce663]/30 px-2 py-1 text-[11px] text-[#bce663]">
                              <FlaskConical className="h-3 w-3" /> {b.doneExams} zrobione
                            </span>
                            {b.activeEpisodes > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[#4dc9f6]/10 border border-[#4dc9f6]/30 px-2 py-1 text-[11px] text-[#4dc9f6]">
                                <Activity className="h-3 w-3" /> {b.activeEpisodes} w leczeniu
                              </span>
                            )}
                            {b.resolvedEpisodes > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[#2e3229] border border-[#3d4237] px-2 py-1 text-[11px] text-[#8c9282]">
                                <CheckCircle className="h-3 w-3" /> {b.resolvedEpisodes} zakończone
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {unassignedDocs.length > 0 && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowUnassigned((v) => !v)}
                        className="w-full sm:w-auto flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-left hover:border-amber-500/60 transition-all"
                      >
                        <span className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-amber-300 shrink-0" />
                          <span>
                            <span className="block text-sm font-bold text-amber-200">
                              Bez przypisania · {unassignedDocs.length}{" "}
                              {unassignedDocs.length === 1 ? "badanie" : "badań"}
                            </span>
                            <span className="block text-[11px] text-amber-300/70">
                              Nie widać ich w żadnej części ciała — kliknij, żeby przypisać.
                            </span>
                          </span>
                        </span>
                        {showUnassigned ? (
                          <ChevronUp className="h-4 w-4 text-amber-300 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-amber-300 shrink-0" />
                        )}
                      </button>

                      {showUnassigned && (
                        <div className="rounded-xl border border-[#2e3229] bg-[#1a1c18] divide-y divide-[#2e3229]/60">
                          {unassignedDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#f1f2ec] truncate">
                                  {doc.title}
                                </p>
                                <p className="text-[10px] text-[#8c9282] font-mono">
                                  {format(new Date(doc.studyDate), "dd.MM.yyyy")}
                                  {doc.laboratory ? ` · ${doc.laboratory}` : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => openEditExam(doc)}
                                className="flex items-center gap-1.5 rounded-lg bg-[#bce663]/10 hover:bg-[#bce663]/20 border border-[#bce663]/30 text-[#bce663] text-xs font-bold px-3 py-1.5 transition-all shrink-0"
                              >
                                <Link2 className="h-3.5 w-3.5" /> Przypisz
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* WIDOK: WSZYSTKIE WIZYTY */}
              {visitsView === "all" && (
                visits.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
                    Brak zarejestrowanych wizyt. Kliknij "Dodaj" w nagłówku.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {datedVisits.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {datedVisits.map(renderVisitCard)}
                      </div>
                    )}
                    {undatedVisits.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d6050]">
                          Bez ustalonego terminu ({undatedVisits.length})
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {undatedVisits.map(renderVisitCard)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* 2. STOMATOLOGIA — FDI ISO 3950 */}
      {activeTab === "dental" && (
        <div className="space-y-6">
          <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#bce663]" /> Mapa zębów (FDI · ISO 3950)
              </CardTitle>
              <CardDescription className="text-xs text-[#8c9282]">
                Numeracja od linii środkowej na zewnątrz. Wybierz ząb, aby zobaczyć historię i dodać zabieg.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Górna prawa | Górna lewa */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-[#8c9282] uppercase tracking-widest text-center">Szczęka (góra)</div>
                <ToothRow teeth={[...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT]} />
              </div>

              {/* Linia środkowa */}
              <div className="flex items-center gap-2 justify-center">
                <div className="flex-1 max-w-xs h-px bg-[#2e3229]" />
                <span className="text-[9px] text-[#5d6050] font-mono">linia środkowa</span>
                <div className="flex-1 max-w-xs h-px bg-[#2e3229]" />
              </div>

              {/* Dolna prawa | Dolna lewa */}
              <div className="space-y-2">
                <ToothRow teeth={[...FDI_LOWER_RIGHT.slice().reverse(), ...FDI_LOWER_LEFT.slice().reverse()]} />
                <div className="text-[10px] font-bold text-[#8c9282] uppercase tracking-widest text-center">Żuchwa (dół)</div>
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap gap-4 justify-center text-[10px] border-t border-[#2e3229] pt-4">
                <Legend color="bg-[#1a1c18]" border="border-[#2e3229]" label="Brak zabiegów" />
                <Legend color="bg-emerald-950" border="border-emerald-500" label="Plomba / Profilaktyka" />
                <Legend color="bg-sky-950" border="border-sky-500" label="Leczenie kanałowe" />
                <Legend color="bg-yellow-950" border="border-yellow-500" label="Implant / Korona" />
                <Legend color="bg-zinc-800 opacity-40" border="border-zinc-700" label="Ząb usunięty" />
              </div>
            </CardContent>
          </Card>

          {/* Lista wizyt stomatologicznych — filtrowana po wybranym zębie */}
          <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-[#f1f2ec]">
                    {selectedTooth !== null
                      ? `Wizyty · ząb FDI #${selectedTooth}`
                      : "Wszystkie wizyty stomatologiczne"}
                  </CardTitle>
                  <CardDescription className="text-xs text-[#8c9282]">
                    {(() => {
                      const filtered = selectedTooth !== null
                        ? dentalRecords.filter((r) => r.toothNumber === selectedTooth)
                        : dentalRecords;
                      if (filtered.length === 0) return "Brak wpisów";
                      return `${filtered.length} ${filtered.length === 1 ? "wpis" : filtered.length < 5 ? "wpisy" : "wpisów"}`;
                    })()}
                  </CardDescription>
                </div>
                {selectedTooth !== null && (
                  <button
                    onClick={() => setSelectedTooth(null)}
                    className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border border-[#2e3229] text-[#8c9282] hover:text-[#bce663] hover:border-[#bce663]/50 transition-colors shrink-0"
                  >
                    Pokaż wszystkie
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const filtered = selectedTooth !== null
                  ? dentalRecords.filter((r) => r.toothNumber === selectedTooth)
                  : dentalRecords;
                if (filtered.length === 0) {
                  return (
                    <p className="text-xs text-[#8c9282] py-4 text-center">
                      {selectedTooth !== null
                        ? `Brak zabiegów dla zęba #${selectedTooth}.`
                        : "Brak wizyt. Kliknij \"Dodaj\" w nagłówku."}
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {filtered.map((record) => (
                      <div key={record.id} className="bg-[#0d0e0c] p-3.5 rounded-lg border border-[#2e3229] flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-[#bce663]/10 text-[#bce663] text-[10px] font-mono capitalize">
                              {record.procedure}
                            </Badge>
                            {record.toothNumber !== null && record.toothNumber !== undefined && (
                              <button
                                onClick={() => setSelectedTooth(selectedTooth === record.toothNumber ? null : record.toothNumber)}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1c18] border border-[#2e3229] text-[#8c9282] hover:text-[#bce663] hover:border-[#bce663]/50 transition-colors"
                                title="Filtruj po tym zębie"
                              >
                                ząb #{record.toothNumber}
                              </button>
                            )}
                            {record.status === "PLANNED" && (
                              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                Umówiony
                              </span>
                            )}
                            <span className="text-xs text-[#8c9282] font-mono">
                              {record.status === "PLANNED"
                                ? record.plannedDate
                                  ? format(new Date(record.plannedDate), "dd.MM.yyyy")
                                  : "Termin nieustalony"
                                : format(new Date(record.date), "dd.MM.yyyy")}
                            </span>
                          </div>
                          {(record.dentistRef?.name || record.dentist) && (
                            <p className="text-xs text-[#f1f2ec] mt-1.5">
                              Stomatolog: {record.dentistRef?.name ?? record.dentist}
                            </p>
                          )}
                          {(record.facilityRef?.name || record.facility) && (
                            <p className="text-[10px] text-[#8c9282]">
                              Placówka: {record.facilityRef?.name ?? record.facility}
                            </p>
                          )}
                          {record.episode?.title && (
                            <p className="text-[10px] text-[#bce663] mt-0.5">
                              Leczenie: {record.episode.title}
                            </p>
                          )}
                          {record.notes && <p className="text-xs text-[#8c9282] mt-2 italic">Notatka: {record.notes}</p>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            onClick={() => openEditDental(record)}
                            className="bg-transparent hover:bg-[#2e3229] text-[#8c9282] hover:text-white p-1.5 h-auto"
                            title="Edytuj zabieg"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteDentalRecord(record.id)}
                            className="bg-transparent hover:bg-rose-500/10 text-[#8c9282] hover:text-rose-400 p-1.5 h-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. LEKI */}
      {activeTab === "meds" && (
        <MedicationManager ref={medsRef} medications={initialMedications} dictionaries={dictionaries} />
      )}

      {/* 4. BADANIA RTG/USG */}
      {activeTab === "imaging" && (
        <div className="space-y-6">
          {imagingDocs.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
              Brak badań obrazowych. Kliknij "Dodaj" w nagłówku.
            </div>
          ) : (
            <div className="space-y-3">
              {imagingDocs.map((doc) => {
                const isPdf = doc.fileUrl && doc.fileUrl.toLowerCase().includes(".pdf");
                
                // Wyodrębnienie podsumowania AI z opisu do prezentacji w 2 liniach
                let aiBrief = "";
                if (doc.description) {
                  const cleanedDesc = doc.description.replace(/\*\*/g, "");
                  const parts = cleanedDesc.split(/(?:KLUCZOWE OBSERWACJE|WNIOSKI|OBSZAR ANATOMICZNY|METODA BADANIA)/i);
                  const mainSummary = parts[0]?.trim();
                  if (mainSummary) {
                    aiBrief = mainSummary;
                    if (aiBrief.length > 200) {
                      aiBrief = aiBrief.slice(0, 197) + "...";
                    }
                  }
                }

                const isExpanded = expandedDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                    className={`group flex flex-col p-4 bg-[#1a1c18] border transition-all duration-300 rounded-xl cursor-pointer relative overflow-hidden ${
                      isExpanded ? "border-[#bce663]/40 shadow-lg shadow-[#bce663]/5" : "border-[#2e3229] hover:border-[#bce663]/30"
                    }`}
                  >
                    {/* Subtelny pionowy pasek akcentujący po lewej stronie */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-[#bce663] transition-transform duration-300 origin-center ${
                      isExpanded ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
                    }`} />

                    {/* Główny wiersz (Zawsze widoczny) */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Kwadratowy kontener podglądu */}
                        <div className="h-16 w-16 rounded-lg bg-[#0d0e0c] border border-[#2e3229] flex items-center justify-center shrink-0 overflow-hidden relative">
                          {doc.fileUrl ? (
                            isPdf ? (
                              <div className="flex flex-col items-center justify-center bg-[#4dc9f6]/5 w-full h-full border border-[#4dc9f6]/10">
                                <FileText className="h-6 w-6 text-[#4dc9f6]" />
                                <span className="text-[8px] text-[#4dc9f6]/70 font-bold mt-0.5 font-mono">PDF</span>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={doc.fileUrl} alt={doc.title} className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105" />
                            )
                          ) : (
                            <ImageIcon className="h-6 w-6 text-[#8c9282]/40" />
                          )}
                        </div>

                        {/* Główne dane (Tytuł i przestrzenne metadane w pionie) */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-[#f1f2ec] truncate group-hover:text-white transition-colors">
                              {doc.title}
                            </h4>
                            <Badge className="bg-[#4dc9f6]/10 text-[#4dc9f6] text-[8px] uppercase font-mono px-1.5 py-0 h-max shrink-0 border border-[#4dc9f6]/20">
                              {doc.tags?.[0] || doc.type}
                            </Badge>
                          </div>
                          
                          {/* Przestrzenny i niezwykle czytelny układ pionowy metadanych */}
                          <div className="flex flex-col gap-1.5 mt-2 text-xs text-[#8c9282]">
                            <span className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-[#bce663] shrink-0" />
                              <span className="font-mono">Badanie z dnia:</span>
                              <strong className="text-[#f1f2ec] font-normal">{format(new Date(doc.studyDate), "dd.MM.yyyy")}</strong>
                            </span>
                            {doc.doctor && (
                              <span className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-[#8c9282] shrink-0" />
                                <span>Lekarz:</span>
                                <strong className="text-[#f1f2ec] font-normal">{doc.doctor}</strong>
                              </span>
                            )}
                            {doc.laboratory && (
                              <span className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-[#8c9282] shrink-0" />
                                <span>Klinika / Placówka:</span>
                                <strong className="text-[#f1f2ec] font-normal truncate max-w-[250px]" title={doc.laboratory}>{doc.laboratory}</strong>
                              </span>
                            )}
                            {/* Przypisanie do części ciała — brak jest widoczny od razu,
                                bo to on decyduje, czy badanie pojawi się w „Wg części ciała". */}
                            <span className="flex items-center gap-2">
                              <Stethoscope className="h-3.5 w-3.5 text-[#8c9282] shrink-0" />
                              <span>Część ciała:</span>
                              {doc.bodyPart?.name ? (
                                <strong className="text-[#f1f2ec] font-normal">
                                  {doc.bodyPart.name}
                                  {doc.episode?.title ? ` · ${doc.episode.title}` : ""}
                                </strong>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditExam(doc);
                                  }}
                                  className="text-amber-300 hover:text-amber-200 underline underline-offset-2 font-semibold"
                                >
                                  nieprzypisane — przypisz
                                </button>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Plakietka sugestii — analiza nic nie zapisała, czeka na decyzję. */}
                      {aiSuggestions[doc.id] && countChanged(aiSuggestions[doc.id]) > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDocId(doc.id);
                            setOpenSuggestions((prev) =>
                              prev.includes(doc.id) ? prev : [...prev, doc.id]
                            );
                          }}
                          className="shrink-0 self-start rounded-lg border border-[#bce663]/30 bg-[#bce663]/10 px-2.5 py-1 text-[10px] font-bold text-[#bce663] hover:bg-[#bce663]/20 transition-all"
                        >
                          <Sparkles className="h-3 w-3 inline mr-1" />
                          AI ma {countChanged(aiSuggestions[doc.id])} sugestii
                        </button>
                      )}

                      {/* Środkowa kolumna: Krótki wgląd AI (tylko gdy zwinięte) */}
                      {!isExpanded && (
                        <div className="flex-1 max-w-full md:max-w-[420px] min-w-0">
                          {aiBrief ? (
                            <p className="text-xs text-[#8c9282]/90 leading-relaxed line-clamp-2">
                              {aiBrief}
                            </p>
                          ) : doc.fileUrl ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-[#5d6050] font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/40 animate-pulse" />
                              Oczekuje na analizę AI
                            </div>
                          ) : (
                            <span className="text-[#5d6050] italic text-xs">Brak opisu badania</span>
                          )}
                        </div>
                      )}

                      {/* Ikona rozwijania (Chevron) */}
                      <div className="text-[#8c9282] group-hover:text-white transition-colors shrink-0 self-end md:self-center">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>

                    {/* Rozwijana sekcja (Widoczna po kliknięciu) */}
                    {isExpanded && (
                      <div className="border-t border-[#2e3229] mt-4 pt-4 w-full transition-all duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-4 w-full">
                          
                          {/* Pełny opis badania */}
                          <div className="space-y-2">
                            <h5 className="text-[10px] text-[#8c9282] font-mono uppercase tracking-wider">
                              Opis badania:
                            </h5>
                            <div className="text-xs text-[#f1f2ec] leading-relaxed whitespace-pre-line font-normal max-w-none pr-4">
                              {doc.description ? (
                                doc.description.replace(/\*\*/g, "")
                              ) : (
                                <span className="text-[#5d6050] italic">Brak wygenerowanego opisu badania.</span>
                              )}
                            </div>
                          </div>

                          {/* Kompaktowe przyciski akcji w jednym wierszu */}
                          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#2e3229]/50 w-full">
                            {doc.fileUrl && (
                              <>
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-center gap-1.5 rounded-lg bg-transparent border border-[#2e3229] hover:bg-[#2e3229] text-xs font-bold text-[#f1f2ec] px-4 py-2 transition-all w-auto text-center"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Otwórz plik
                                </a>
                                <a
                                  href={doc.fileUrl}
                                  download={doc.title}
                                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2e3229] hover:bg-[#3d4237] text-xs font-bold text-[#f1f2ec] px-4 py-2 transition-all w-auto text-center"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Pobierz
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => openEditExam(doc)}
                              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#bce663]/10 hover:bg-[#bce663]/20 border border-[#bce663]/30 text-[#bce663] text-xs font-bold px-4 py-2 transition-all w-auto text-center"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edytuj
                            </button>
                            {doc.fileUrl && (
                              <button
                                onClick={() => handleTriggerAI(doc.id)}
                                disabled={summarizingIds.includes(doc.id)}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-transparent border border-[#2e3229] hover:bg-[#2e3229] text-xs font-bold text-[#f1f2ec] px-4 py-2 transition-all w-auto text-center disabled:opacity-50"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                {summarizingIds.includes(doc.id)
                                  ? "Analizuję..."
                                  : doc.description
                                  ? "Przeanalizuj ponownie"
                                  : "Przeanalizuj AI"}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteImaging(doc.id)}
                              className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-bold px-4 py-2 transition-all w-auto text-center"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Usuń badanie
                            </button>
                          </div>

                          {/* Panel sugestii AI — zapis dopiero po zaznaczeniu i kliknięciu. */}
                          {openSuggestions.includes(doc.id) && aiSuggestions[doc.id] && (
                            <AiSuggestionsPanel
                              documentId={doc.id}
                              suggestions={aiSuggestions[doc.id]}
                              currentTags={Array.isArray(doc.tags) ? doc.tags : []}
                              onDismiss={() => dismissSuggestions(doc.id)}
                              onApplied={handleSuggestionsApplied}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. WYNIKI BADAŃ */}
      {activeTab === "docs" && (
        <div className="space-y-6">
          <DocumentsManager documents={initialDocuments} dictionaries={dictionaries} />
        </div>
      )}

      {/* 6. BADANIA LABORATORYJNE (BIOMARKERY) */}
      {activeTab === "blood" && (() => {
        const filteredMarkers = bloodMarkers.filter((m) => {
          if (biomarkerFilter === "Wszystkie") return true;
          if (biomarkerFilter === "NORMAL") return m.status === "NORMAL";
          // UNKNOWN (rozjazd jednostek) NIE jest "poza normą" — brak oceny to
          // osobny stan, inaczej wracałby fałszywy alarm tylnymi drzwiami.
          if (biomarkerFilter === "ABNORMAL") return m.status === "HIGH" || m.status === "LOW";
          if (biomarkerFilter === "UNKNOWN") return m.status === "UNKNOWN";
          return getBiomarkerCategory(m.name) === biomarkerFilter;
        });

        return (
          <div className="space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista markerów + Przypomnienie */}
              <div className="lg:col-span-1 space-y-3">
                <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-[#bce663]" /> Biomarkery
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <button
                          onClick={() => setBiomarkerFilter(biomarkerFilter === "NORMAL" ? "Wszystkie" : "NORMAL")}
                          className={`border px-2 py-0.5 rounded-full transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${biomarkerFilter === "NORMAL"
                            ? "bg-emerald-500/25 text-emerald-300 border-emerald-400 ring-2 ring-emerald-500/35"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
                            }`}
                          title="Filtruj: w normie"
                        >
                          {bloodMarkers.filter((m) => m.status === "NORMAL").length} w normie
                        </button>
                        {bloodMarkers.filter((m) => m.status === "UNKNOWN").length > 0 && (
                          <button
                            onClick={() => setBiomarkerFilter(biomarkerFilter === "UNKNOWN" ? "Wszystkie" : "UNKNOWN")}
                            className={`border px-2 py-0.5 rounded-full transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${biomarkerFilter === "UNKNOWN"
                              ? "bg-amber-500/25 text-amber-300 border-amber-400 ring-2 ring-amber-500/35"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15"
                              }`}
                            title="Filtruj: bez oceny — jednostka wyniku nie zgadza się z jednostką normy"
                          >
                            {bloodMarkers.filter((m) => m.status === "UNKNOWN").length} bez oceny
                          </button>
                        )}
                        {bloodMarkers.filter((m) => m.status === "HIGH" || m.status === "LOW").length > 0 && (
                          <button
                            onClick={() => setBiomarkerFilter(biomarkerFilter === "ABNORMAL" ? "Wszystkie" : "ABNORMAL")}
                            className={`border px-2 py-0.5 rounded-full transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.98] ${biomarkerFilter === "ABNORMAL"
                              ? "bg-rose-500/25 text-rose-300 border-rose-400 ring-2 ring-rose-500/35"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15"
                              }`}
                            title="Filtruj: poza normą"
                          >
                            {bloodMarkers.filter((m) => m.status === "HIGH" || m.status === "LOW").length} poza
                          </button>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-xs text-[#8c9282]">
                      Kliknij marker, aby przeanalizować trend historyczny.
                    </CardDescription>
                  </CardHeader>

                  {/* Filtry kategorii */}
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setBiomarkerFilter("Wszystkie")}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${biomarkerFilter === "Wszystkie"
                        ? "bg-[#bce663] text-[#0d0e0c] border-[#bce663]"
                        : "bg-transparent text-[#8c9282] border-[#2e3229] hover:border-[#bce663]/50"
                        }`}
                    >
                      Wszystkie
                    </button>
                    {BIOMARKER_CATEGORIES.filter((cat) =>
                      bloodMarkers.some((m) => getBiomarkerCategory(m.name) === cat)
                    ).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setBiomarkerFilter(cat)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${biomarkerFilter === cat
                          ? "bg-[#bce663] text-[#0d0e0c] border-[#bce663]"
                          : "bg-transparent text-[#8c9282] border-[#2e3229] hover:border-[#bce663]/50"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <CardContent className="p-0">
                    {bloodMarkers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#8c9282]">
                        Brak wgranych badań krwi w archiwum dokumentów.
                      </div>
                    ) : filteredMarkers.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#8c9282]">
                        Brak biomarkerów spełniających kryteria filtra.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#2e3229] max-h-[500px] overflow-y-auto">
                        {filteredMarkers.map((marker) => (
                          <button
                            key={marker.name}
                            onClick={() => setSelectedMarker(marker.name)}
                            className={`w-full text-left p-3.5 flex justify-between items-center transition-all ${selectedMarker === marker.name ? "bg-[#2e3229]/40 border-l-4 border-[#bce663]" : "hover:bg-[#2e3229]/20"
                              }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-[#f1f2ec]">{marker.name}</p>
                              <p className="text-[10px] text-[#8c9282] mt-0.5">
                                Norma: {marker.norm}
                                {marker.status === "UNKNOWN" && marker.norm !== "—" ? ` ${marker.normUnit}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono font-bold text-[#f1f2ec]">
                                {marker.latestValue} <span className="text-[10px] text-[#8c9282] font-sans">{marker.unit}</span>
                              </p>
                              <Badge
                                className={`text-[9px] mt-1 ${marker.status === "NORMAL"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : marker.status === "HIGH"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : marker.status === "LOW"
                                      ? "bg-sky-500/10 text-sky-400"
                                      : "bg-amber-500/10 text-amber-400"
                                  }`}
                                title={marker.status === "UNKNOWN"
                                  ? `Wynik w ${marker.unit}, norma w ${marker.normUnit} — inne skale, brak oceny`
                                  : undefined}
                              >
                                {marker.status === "NORMAL"
                                  ? "Norma"
                                  : marker.status === "HIGH"
                                    ? "Za Wysoko"
                                    : marker.status === "LOW"
                                      ? "Za Nisko"
                                      : "Bez oceny"}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>

              {/* Wykresy markera */}
              <div className="lg:col-span-2 space-y-4">
                {activeMarker ? (
                  activeMarker.curves && activeMarker.curves.length > 0 ? (
                    activeMarker.curves.map((curve: any, cIdx: number) => (
                      <Card key={cIdx} className="bg-[#1a1c18] border-[#2e3229] rounded-xl flex flex-col min-h-[380px]">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-bold text-[#f1f2ec] flex items-center justify-between">
                            <span>Wykres Trendu: {activeMarker.name} ({curve.unit})</span>
                            <Badge className={
                              curve.status === "NORMAL"
                                ? "bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/20"
                                : curve.status === "HIGH"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : curve.status === "LOW"
                                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }>
                              {curve.latestValue} {curve.unit} · {curve.status === "NORMAL"
                                ? "Norma"
                                : curve.status === "HIGH"
                                  ? "Za Wysoko"
                                  : curve.status === "LOW"
                                    ? "Za Nisko"
                                    : "Bez oceny"}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs text-[#8c9282]">
                            Zalecana norma: {curve.norm} {curve.normUnit ?? curve.unit}
                            {curve.status === "UNKNOWN" && (
                              <span className="block mt-0.5 text-amber-400/80">
                                Wynik podany w {curve.unit} — inna skala niż norma, więc nie oceniamy.
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-center">
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={curve.history} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8c9282" }} stroke="#2e3229" />
                                <YAxis tick={{ fontSize: 10, fill: "#8c9282" }} stroke="#2e3229" unit={` ${curve.unit}`} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  name={`${activeMarker.name} (${curve.unit})`}
                                  stroke="#bce663"
                                  strokeWidth={3}
                                  dot={{ r: 5, stroke: "#0d0e0c", strokeWidth: 2, fill: "#bce663" }}
                                  activeDot={{ r: 7 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    // Fallback dla pojedynczego wykresu w przypadku braku curves
                    <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl flex flex-col min-h-[450px]">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-[#f1f2ec]">
                          Wykres Trendu: {activeMarker.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-[#8c9282]">
                          Analiza zmian poziomu markera z ostatnich badań. Zalecana norma: {activeMarker.norm} {activeMarker.unit}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col justify-center">
                        <div className="h-[350px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={activeMarker.history} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8c9282" }} stroke="#2e3229" />
                              <YAxis tick={{ fontSize: 10, fill: "#8c9282" }} stroke="#2e3229" unit={` ${activeMarker.unit}`} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                              <Line
                                type="monotone"
                                dataKey="value"
                                name={activeMarker.name}
                                stroke="#bce663"
                                strokeWidth={3}
                                dot={{ r: 5, stroke: "#0d0e0c", strokeWidth: 2, fill: "#bce663" }}
                                activeDot={{ r: 7 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full bg-[#1a1c18] border border-[#2e3229] rounded-xl text-[#8c9282] text-xs min-h-[450px]">
                    Wybierz marker z lewej listy, aby przeanalizować wykres trendu.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7. SUPLEMENTACJA */}
      {activeTab === "supplements" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-[#1a1c18] border border-[#2e3229] rounded-2xl p-4 md:p-6">
            <SupplementManager
              ref={supplementsRef}
              supplements={initialSupplements}
              todayIntakes={initialTodayIntakes}
              nutrients={nutrients}
              hideAddButton={true}
            />
          </div>
          <div className="lg:col-span-4">
            <NutrientIntakeSummary
              todayIntakes={initialTodayIntakes}
              supplements={initialSupplements}
              nutrients={nutrients}
            />
          </div>
        </div>
      )}

      {/* 8. WYDOLNOŚĆ I TRENING */}
      {activeTab === "training" && (
        <TrainingAnalyticsTab
          activities={activities}
          strengthWorkouts={strengthWorkouts}
        />
      )}

      {/* 9. PROFILAKTYKA */}
      {activeTab === "prevention" && (() => {
        const recs = getRecommendations(
          userProfile?.birthDate || null,
          userProfile?.sex || null,
          initialDocuments,
          imagingDocs,
          visits,
          dentalRecords
        );

        const vaccinations = healthEvents.filter((e: any) => e.type === "VACCINATION");

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* KOLUMNA 1 & 2: REKOMENDACJE BADAN */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-[#2e3229] bg-[#0d0e0c]/30">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#bce663]" />
                      <div>
                        <CardTitle className="text-lg text-[#f1f2ec]">Spersonalizowane Badania Profilaktyczne</CardTitle>
                        <CardDescription className="text-xs text-[#8c9282]">
                          Rekomendacje dopasowane do Twojego profilu (Płeć: {userProfile?.sex === "F" ? "Kobieta" : userProfile?.sex === "M" ? "Mężczyzna" : "Nie określono"}, Wiek: {userProfile?.birthDate ? (new Date().getFullYear() - new Date(userProfile.birthDate).getFullYear()) : "30"} lat) na podstawie historii badań i wizyt.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      {recs.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-4 rounded-xl border border-[#2e3229] bg-[#0d0e0c]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-[#bce663]/30 transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[#f1f2ec]">{rec.name}</span>
                              {rec.status === "OK" ? (
                                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[9px] font-bold">
                                  Aktualne
                                </Badge>
                              ) : rec.status === "WARN" ? (
                                <Badge className="bg-amber-950 text-amber-400 border-amber-800 text-[9px] font-bold">
                                  Zalecane powtórzenie
                                </Badge>
                              ) : (
                                <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[9px] font-bold">
                                  Brak danych
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#8c9282] max-w-xl">{rec.description}</p>
                            <p className="text-[10px] text-[#5d6050] font-mono">
                              Częstotliwość: co {rec.frequencyMonths} miesięcy | Ostatnie wykonanie: {rec.lastDate ? format(new Date(rec.lastDate), "dd.MM.yyyy") : "nigdy"}
                            </p>
                          </div>
                          
                          <div className="shrink-0 flex items-center gap-2">
                            {rec.status === "OK" ? (
                              <CheckCircle className="h-5 w-5 text-[#bce663]" />
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                <Bell className="h-3.5 w-3.5" />
                                <span>Wykonaj</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* KOLUMNA 3: SKIEROWANIA I SZCZEPIENIA */}
              <div className="space-y-6">
                {/* KARTA: SKIEROWANIA (wydzielona — patrz referrals-card.tsx) */}
                <ReferralsCard
                  referrals={referrals}
                  dictionaries={dictionaries!}
                  onAdd={() => setReferralModalOpen(true)}
                  onChanged={(ref, action) => {
                    setReferrals((prev: any[]) =>
                      action === "delete"
                        ? prev.filter((r) => r.id !== ref.id)
                        : prev.some((r) => r.id === ref.id)
                        ? prev.map((r) => (r.id === ref.id ? ref : r))
                        : [ref, ...prev]
                    );
                    router.refresh();
                  }}
                />

                {/* KARTA: SZCZEPIENIA */}
                <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-[#2e3229] bg-[#0d0e0c]/30 flex flex-row justify-between items-center py-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-[#bce663]" />
                      <CardTitle className="text-sm text-[#f1f2ec]">Rejestr Szczepień</CardTitle>
                    </div>
                    <Button
                      onClick={() => setVaccinationModalOpen(true)}
                      size="sm"
                      className="bg-[#bce663]/10 hover:bg-[#bce663]/20 text-[#bce663] text-xs font-bold border border-[#bce663]/20 rounded-lg h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Dodaj
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {vaccinations.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-[#2e3229] rounded-xl text-[10px] text-[#8c9282] bg-[#0d0e0c]/20">
                        Brak wpisów o szczepieniach.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {vaccinations.map((vac: any) => (
                          <div
                            key={vac.id}
                            className="p-3 rounded-xl border border-[#2e3229] bg-[#0d0e0c]/10 flex justify-between items-start gap-3"
                          >
                            <div className="space-y-1">
                              <h4 className="font-semibold text-xs text-[#f1f2ec]">{vac.title}</h4>
                              {vac.description && <p className="text-[10px] text-[#8c9282]">{vac.description}</p>}
                              <p className="text-[9px] text-[#5d6050] font-mono">
                                Data: {format(new Date(vac.date), "dd.MM.yyyy")}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteVaccination(vac.id)}
                              className="p-1 text-[#8c9282] hover:text-red-400 transition-all shrink-0"
                              title="Usuń"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: WIZYTA (wspólny z drill-downem części ciała).
          Ma datalisty lekarzy/placówek/części ciała, wybór leczenia i tryb edycji —
          w odróżnieniu od poprzedniego, uproszczonego formularza w tym pliku. */}
      {dictionaries && (
        <VisitFormModal
          key={`visit-${visitModalOpen ? "open" : "closed"}`}
          open={visitModalOpen}
          onClose={() => setVisitModalOpen(false)}
          dictionaries={dictionaries}
          onCreated={(visit) => {
            setVisits((prev) => [visit, ...prev]);
            router.refresh();
          }}
        />
      )}

      {/* MODAL: NOWA CZĘŚĆ CIAŁA / LECZENIE */}
      {dictionaries && (
        <BodyPartFormModal
          key={`bodypart-${bodyPartModalOpen ? "open" : "closed"}`}
          open={bodyPartModalOpen}
          onClose={() => setBodyPartModalOpen(false)}
          dictionaries={dictionaries}
          onSaved={() => router.refresh()}
        />
      )}

      {/* MODAL: BADANIE KONTROLNE zaproponowane przez AI (poz. 5) */}
      {followUp && dictionaries && (
        <FollowUpModal
          open
          sourceDocumentId={followUp.documentId}
          suggestion={followUp.suggestion}
          dictionaries={dictionaries}
          onClose={() => setFollowUp(null)}
          onResolved={() => router.refresh()}
        />
      )}

      {/* MODAL: ZABIEG STOMATOLOGICZNY (wydzielony — patrz dental-form-modal.tsx) */}
      <DentalFormModal
        key={`dental-${dentalModalOpen ? "open" : "closed"}-${editDental?.id ?? "new"}-${selectedTooth ?? "none"}`}
        open={dentalModalOpen}
        onClose={() => {
          setDentalModalOpen(false);
          setEditDental(null);
        }}
        dictionaries={dictionaries!}
        presetTooth={selectedTooth}
        editRecord={editDental}
        onSaved={handleDentalSaved}
      />

      {/* MODAL: BADANIE (wspólny z drill-downem części ciała).
          Ten sam formularz obsługuje dodawanie i edycję — dzięki temu badanie dodane
          z zakładki „Badania RTG/USG" ma komplet pól (część ciała, leczenie, status). */}
      {dictionaries && (
        <ExamFormModal
          key={`exam-${examModalOpen ? "open" : "closed"}-${editExam?.id ?? "new"}`}
          open={examModalOpen}
          onClose={() => {
            setExamModalOpen(false);
            setEditExam(null);
          }}
          dictionaries={dictionaries}
          presetType={examPresetType}
          editExam={editExam}
          onSaved={handleExamSaved}
        />
      )}

      {/* Słownik placówek — globalny dla wszystkich formularzy w zakładce Zdrowie */}
      <datalist id="facility-suggestions">
        {facilitySuggestions.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <AddDocumentModal
        isOpen={documentModalOpen}
        dictionaries={dictionaries}
        onClose={() => setDocumentModalOpen(false)}
        onSaved={() => {
          router.refresh();
        }}
      />

      {/* MODAL: DODAJ SKIEROWANIE */}
      <Modal
        isOpen={referralModalOpen}
        onClose={() => { setReferralModalOpen(false); resetReferralForm(); }}
        title="Dodaj skierowanie"
        description="Wprowadź dane skierowania lekarskiego."
        size="md"
      >
        <form onSubmit={handleAddReferral} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="refTitle" className="text-xs text-[#8c9282]">Nazwa skierowania</Label>
            <Input id="refTitle" type="text" placeholder="np. Badanie echo serca"
              value={refTitle} onChange={(e) => setRefTitle(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="refSpecialization" className="text-xs text-[#8c9282]">Specjalizacja</Label>
              <Input id="refSpecialization" type="text" placeholder="np. Kardiolog"
                value={refSpecialization} onChange={(e) => setRefSpecialization(e.target.value)}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="refDoctorName" className="text-xs text-[#8c9282]">Lekarz</Label>
              <Input id="refDoctorName" type="text" placeholder="np. dr Jan Kowalski"
                value={refDoctorName} onChange={(e) => setRefDoctorName(e.target.value)}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="refIssueDate" className="text-xs text-[#8c9282]">Data wystawienia</Label>
              <Input id="refIssueDate" type="date" value={refIssueDate} onChange={(e) => setRefIssueDate(e.target.value)}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="refExpiryDate" className="text-xs text-[#8c9282]">Data ważności (opcjonalnie)</Label>
              <Input id="refExpiryDate" type="date" value={refExpiryDate} onChange={(e) => setRefExpiryDate(e.target.value)}
                className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="refCode" className="text-xs text-[#8c9282]">4-cyfrowy kod e-skierowania (opcjonalnie)</Label>
            <Input id="refCode" type="text" maxLength={4} placeholder="np. 4312"
              value={refCode} onChange={(e) => setRefCode(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="refNotes" className="text-xs text-[#8c9282]">Notatki (opcjonalnie)</Label>
            <Textarea id="refNotes" placeholder="np. Dodatkowe uwagi"
              value={refNotes} onChange={(e) => setRefNotes(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[60px]" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={() => { setReferralModalOpen(false); resetReferralForm(); }}
              className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs">
              Anuluj
            </Button>
            <Button type="submit" disabled={refLoading}
              className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs">
              {refLoading ? "Zapisywanie..." : "Zapisz skierowanie"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: DODAJ SZCZEPIENIE */}
      <Modal
        isOpen={vaccinationModalOpen}
        onClose={() => { setVaccinationModalOpen(false); resetVaccinationForm(); }}
        title="Dodaj szczepienie"
        description="Wprowadź informacje o wykonanym szczepieniu."
        size="md"
      >
        <form onSubmit={handleAddVaccination} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="vacTitle" className="text-xs text-[#8c9282]">Nazwa szczepionki</Label>
            <Input id="vacTitle" type="text" placeholder="np. Grypa - VaxigripTetra"
              value={vacTitle} onChange={(e) => setVacTitle(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vacDate" className="text-xs text-[#8c9282]">Data szczepienia</Label>
            <Input id="vacDate" type="date" value={vacDate} onChange={(e) => setVacDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vacDescription" className="text-xs text-[#8c9282]">Notatki (opcjonalnie)</Label>
            <Textarea id="vacDescription" placeholder="np. numer serii szczepionki, termin kolejnej dawki"
              value={vacDescription} onChange={(e) => setVacDescription(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[60px]" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={() => { setVaccinationModalOpen(false); resetVaccinationForm(); }}
              className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs">
              Anuluj
            </Button>
            <Button type="submit" disabled={vacLoading}
              className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs">
              {vacLoading ? "Zapisywanie..." : "Zapisz szczepienie"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3.5 h-3.5 rounded ${color} border ${border}`} />
      <span className="text-[#8c9282]">{label}</span>
    </div>
  );
}

interface DailyMetricsTabProps {
  dailyMetrics: any[];
  sleepSessions: any[];
}

function DailyMetricsTab({ dailyMetrics, sleepSessions }: DailyMetricsTabProps) {
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  // Merge daily metrics and sleep sessions by date (YYYY-MM-DD)
  const mergedData = (() => {
    const dataMap: Record<string, any> = {};

    // Process daily metrics
    for (const m of dailyMetrics) {
      if (!m.date) continue;
      const dateKey = m.date.split("T")[0];
      const rawData = m.rawData && typeof m.rawData === "object" ? (m.rawData as Record<string, any>) : {};
      
      dataMap[dateKey] = {
        date: dateKey,
        steps: m.steps || null,
        restingHr: m.restingHr || null,
        hrv: m.hrv || null,
        spo2: m.spo2 || null,
        stressScore: m.stressScore || null,
        activeCalories: m.activeCalories || null,
        totalCalories: m.totalCalories || null,
        sleepMins: null,
        sleepEff: null,
        deepMins: null,
        remMins: null,
        lightMins: null,
        awakeMins: null,
        rawMetric: m,
        rawSleep: null,
        bodyBatteryMax: rawData.bodyBatteryMax || null,
        bodyBatteryMin: rawData.bodyBatteryMin || null,
        vo2max: rawData.vo2max || null,
        bodyBatteryTrend: rawData.bodyBatteryTrend || [],
        stressTrend: rawData.stressTrend || [],
      };
    }

    // Process sleep sessions
    for (const s of sleepSessions) {
      if (!s.date) continue;
      const dateKey = s.date.split("T")[0];
      if (!dataMap[dateKey]) {
        dataMap[dateKey] = {
          date: dateKey,
          steps: null,
          restingHr: null,
          hrv: null,
          spo2: null,
          stressScore: null,
          activeCalories: null,
          totalCalories: null,
          rawMetric: null,
          bodyBatteryMax: null,
          bodyBatteryMin: null,
          vo2max: null,
          bodyBatteryTrend: [],
          stressTrend: [],
        };
      }
      dataMap[dateKey].sleepMins = s.totalMinutes || null;
      dataMap[dateKey].sleepEff = s.efficiency || null;
      dataMap[dateKey].deepMins = s.deepMinutes || null;
      dataMap[dateKey].remMins = s.remMinutes || null;
      dataMap[dateKey].lightMins = s.lightMinutes || null;
      dataMap[dateKey].awakeMins = s.awakeMinutes || null;
      dataMap[dateKey].rawSleep = s;
    }

    // Calculate Health Score for each day
    const result = Object.values(dataMap).map((day: any) => {
      const breakdown = calculateDailyHealthScore(day.rawMetric, day.rawSleep);
      return {
        ...day,
        healthScore: breakdown.score,
        hasData: breakdown.hasData,
        sleepScore: breakdown.sleepScore,
        stepsScore: breakdown.stepsScore,
        stressScoreComp: breakdown.stressScore,
        regenScore: breakdown.regenScore,
        // formatted date for charts e.g. "03.06"
        formattedDate: format(new Date(day.date), "dd.MM"),
      };
    });

    // Sort chronologically
    return result.sort((a, b) => a.date.localeCompare(b.date));
  })();

  // Filter based on timeRange
  const chartData = (() => {
    if (mergedData.length === 0) return [];
    return mergedData.slice(-timeRange);
  })();

  // Get current day data (last element in sorted array)
  const currentDay = mergedData.length > 0 ? mergedData[mergedData.length - 1] : null;
  const currentScore = currentDay && currentDay.hasData ? currentDay.healthScore : 0;
  const currentScoreInterp = getHealthScoreInterpretation(currentScore);

  const formatSleepTime = (mins: number | null) => {
    if (mins == null || mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (mergedData.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
        Brak danych o dziennych wynikach zdrowia. Skonfiguruj Garmin Connect w Ustawieniach i wykonaj pierwszą synchronizację.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK SEKCJII I FILTR OKRESU */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#1a1c18] p-4 rounded-2xl border border-[#2e3229]">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#8c9282]">
            Dzienny stan zdrowia i trendy
          </h2>
          <p className="text-xs text-[#8c9282] mt-0.5">
            Zestawienie passive tracking z urządzeń noszonych. Ostatni odczyt: {currentDay ? format(new Date(currentDay.date), "dd.MM.yyyy") : "—"}.
          </p>
        </div>
        <div className="flex gap-1 bg-[#0d0e0c] p-1 rounded-xl border border-[#2e3229]">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${timeRange === days
                ? "bg-[#bce663] text-[#0d0e0c]"
                : "text-[#8c9282] hover:text-[#f1f2ec]"
                }`}
            >
              {days} dni
            </button>
          ))}
        </div>
      </div>

      {/* DZISIEJSZE WYNIKI (DASHBOARD WYNIKU) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lewy panel: Koło postępu i podsumowanie */}
        <Card className="lg:col-span-4 bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-2 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-sm font-bold text-[#f1f2ec] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#bce663]" />
              Wynik dzisiejszy
            </CardTitle>
            <CardDescription className="text-xs text-[#8c9282]">
              Średnia ważona z dzisiejszych odczytów
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-6 flex flex-col items-center justify-center flex-1 space-y-6">
            {/* SVG Circular Progress */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-[#2e3229]"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-[#bce663] transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - currentScore / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              {/* Text overlay */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-white font-mono leading-none">
                  {currentScore}
                </span>
                <span className="text-[10px] uppercase font-bold text-[#8c9282] mt-1.5 tracking-wider">
                  / 100
                </span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <Badge className={`${currentScoreInterp.bgClass} ${currentScoreInterp.colorClass} border font-bold text-xs px-3 py-1`}>
                {currentScoreInterp.label}
              </Badge>
              <p className="text-[11px] text-[#8c9282] max-w-[200px] leading-normal pt-2">
                Twój organizm jest dzisiaj w {currentScore >= 75 ? "bardzo dobrej" : currentScore >= 60 ? "dobrej" : "obniżonej"} kondycji regeneracyjnej.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Prawy panel: Grid szczegółowych kafelków metryk */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Kroki */}
          <MetricCard
            title="Kroki"
            value={currentDay?.steps?.toLocaleString("pl-PL") || "—"}
            unit="kroków"
            subtitle={currentDay?.steps ? `${Math.round((currentDay.steps / 10000) * 100)}% celu` : "Cel: 10k"}
            icon={<Activity className="h-4 w-4 text-emerald-400" />}
            colorClass="text-emerald-400"
          />

          {/* Sen */}
          <MetricCard
            title="Czas snu"
            value={formatSleepTime(currentDay?.sleepMins)}
            unit=""
            subtitle={currentDay?.sleepEff ? `Wydajność: ${Math.round(currentDay.sleepEff)}%` : "Brak danych o fazach"}
            icon={<Moon className="h-4 w-4 text-sky-400" />}
            colorClass="text-sky-400"
          />

          {/* Tętno spoczynkowe */}
          <MetricCard
            title="Tętno spocz."
            value={currentDay?.restingHr || "—"}
            unit="bpm"
            subtitle={currentDay?.restingHr ? (currentDay.restingHr <= 55 ? "Świetne" : "W normie") : "Brak odczytu"}
            icon={<Heart className="h-4 w-4 text-rose-400" />}
            colorClass="text-rose-400"
          />

          {/* HRV */}
          <MetricCard
            title="Średnie HRV"
            value={currentDay?.hrv ? `${Math.round(currentDay.hrv)}` : "—"}
            unit="ms"
            subtitle={currentDay?.hrv ? (currentDay.hrv >= 55 ? "Wysokie (Regeneracja)" : "Normalne") : "Brak odczytu"}
            icon={<Sparkles className="h-4 w-4 text-lime-400" />}
            colorClass="text-lime-400"
          />

          {/* Stres */}
          <MetricCard
            title="Poziom stresu"
            value={currentDay?.stressScore != null ? `${Math.round(currentDay.stressScore)}` : "—"}
            unit="/ 100"
            subtitle={currentDay?.stressScore != null ? (currentDay.stressScore <= 25 ? "Niski stres" : currentDay.stressScore <= 50 ? "Umiarkowany" : "Wysoki stres") : "Brak odczytu"}
            icon={<Brain className="h-4 w-4 text-orange-400" />}
            colorClass="text-orange-400"
          />

          {/* SpO2 */}
          <MetricCard
            title="Natlenienie SpO2"
            value={currentDay?.spo2 ? `${Math.round(currentDay.spo2)}` : "—"}
            unit="%"
            subtitle={currentDay?.spo2 ? (currentDay.spo2 >= 95 ? "Prawidłowe" : "Obniżone") : "Brak odczytu"}
            icon={<Bell className="h-4 w-4 text-cyan-400" />}
            colorClass="text-cyan-400"
          />

          {/* Body Battery */}
          <MetricCard
            title="Body Battery"
            value={currentDay?.bodyBatteryMax != null ? `${currentDay.bodyBatteryMax}` : "—"}
            unit=""
            subtitle={currentDay?.bodyBatteryMax != null ? `Min: ${currentDay.bodyBatteryMin ?? "—"} · Max: ${currentDay.bodyBatteryMax}` : "Brak danych (Garmin)"}
            icon={<Zap className="h-4 w-4 text-amber-400" />}
            colorClass="text-amber-400"
          />

          {/* VO2max */}
          <MetricCard
            title="Wydolność VO2max"
            value={currentDay?.vo2max != null ? `${currentDay.vo2max.toFixed(1)}` : "—"}
            unit=""
            subtitle={currentDay?.vo2max ? "Status: Pobrano" : "Brak danych (Garmin)"}
            icon={<Trophy className="h-4 w-4 text-[#bce663]" />}
            colorClass="text-[#bce663]"
          />
        </div>
      </div>

      {/* WYKRESY TRENDÓW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wykres 1: Wynik zdrowia vs Stres */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Trend Regeneracji i Stresu
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4" style={{ height: 288, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#bce663" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#bce663" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
                <YAxis domain={[0, 100]} stroke="#5d6050" fontSize={10} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                <RechartsLegend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Area yAxisId="left" type="monotone" name="Wynik zdrowia" dataKey="healthScore" stroke="#bce663" strokeWidth={2} fillOpacity={1} fill="url(#colorHealth)" />
                <Line yAxisId="left" type="monotone" name="Poziom stresu" dataKey="stressScore" stroke="#fb923c" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Wykres 2: Kroki vs Tętno Spoczynkowe */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Kroki i Tętno spoczynkowe
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4" style={{ height: 288, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: -15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
                <YAxis yAxisId="left" orientation="left" stroke="#10b981" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" domain={["dataMin - 5", "dataMax + 5"]} stroke="#f43f5e" fontSize={10} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                <RechartsLegend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Bar yAxisId="left" name="Kroki" dataKey="steps" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.6} />
                <Line yAxisId="right" name="Tętno spocz." type="monotone" dataKey="restingHr" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Wykres 3: Analiza faz snu */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Fazy snu (skumulowane)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4" style={{ height: 288, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
                <YAxis stroke="#5d6050" name="Minuty" fontSize={10} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} formatter={(value) => [`${value} min`, ""]} />
                <RechartsLegend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Bar dataKey="deepMins" name="Głęboki" stackId="a" fill="#1e3a8a" />
                <Bar dataKey="remMins" name="REM" stackId="a" fill="#0369a1" />
                <Bar dataKey="lightMins" name="Lekki" stackId="a" fill="#38bdf8" />
                <Bar dataKey="awakeMins" name="Wybudzenia" stackId="a" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Wykres 4: Zmienność Tętna (HRV) */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Zmienność tętna (HRV status)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4" style={{ height: 288, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHrv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
                <YAxis domain={["dataMin - 10", "dataMax + 10"]} stroke="#5d6050" fontSize={10} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                <RechartsLegend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Area type="monotone" name="Średnie HRV" dataKey="hrv" stroke="#84cc16" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHrv)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Wykres 5: Trend Body Battery (Garmin) */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Trend Body Battery (Garmin)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4" style={{ height: 288, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
                <YAxis domain={[0, 100]} stroke="#5d6050" fontSize={10} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                <RechartsLegend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Area type="monotone" name="Maks. energia (Max)" dataKey="bodyBatteryMax" stroke="#fbbf24" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBb)" />
                <Line type="monotone" name="Min. energia (Min)" dataKey="bodyBatteryMin" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Wykres 6: Trend VO2max (Garmin) */}
        <Card className="bg-[#1a1c18] border-[#2e3229] rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#2e3229] bg-[#0d0e0c]/30">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#8c9282]">
              Trend VO2max (Garmin)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 px-4" style={{ height: 288, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.vo2max != null)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3229" />
                <XAxis dataKey="formattedDate" stroke="#5d6050" fontSize={10} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke="#5d6050" fontSize={10} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} />
                <RechartsLegend verticalAlign="top" height={36} iconType="circle" fontSize={11} />
                <Line type="monotone" name="Wskaźnik VO2max" dataKey="vo2max" stroke="#bce663" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  colorClass,
}: {
  title: string;
  value: string | number;
  unit: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <Card className="bg-[#1a1c18] border-[#2e3229] hover:border-[#bce663]/30 transition-all rounded-xl p-4 flex flex-col justify-between min-h-[110px]">
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-[#8c9282] truncate">
          {title}
        </span>
        <div className="bg-[#0d0e0c] p-1.5 rounded-lg border border-[#2e3229] shrink-0">
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <span className={`text-xl sm:text-2xl font-extrabold font-mono leading-none ${colorClass}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[10px] text-[#8c9282] ml-1 font-semibold uppercase tracking-wider">
            {unit}
          </span>
        )}
        <p className="text-[9px] sm:text-[10px] text-[#8c9282] mt-1 font-medium truncate">
          {subtitle}
        </p>
      </div>
    </Card>
  );
}

function getRecommendations(
  birthDateStr: string | null,
  sex: string | null,
  documents: any[],
  imaging: any[],
  visits: any[],
  dental: any[]
) {
  let age = 30;
  if (birthDateStr) {
    const birthYear = new Date(birthDateStr).getFullYear();
    const currentYear = new Date().getFullYear();
    age = currentYear - birthYear;
  }
  const isFemale = sex === "F";

  const list = [
    {
      id: "morfologia",
      name: "Morfologia krwi",
      frequencyMonths: 12,
      description: "Podstawowe badanie oceniające ogólny stan zdrowia i funkcjonowanie organizmu.",
      keywords: ["morfologia", "krew"],
      source: "lab",
    },
    {
      id: "mocz",
      name: "Badanie ogólne moczu",
      frequencyMonths: 12,
      description: "Ocena funkcjonowania nerek, układu moczowego oraz obecności cukru czy białka.",
      keywords: ["mocz", "badanie ogolne moczu"],
      source: "lab",
    },
    {
      id: "lipidogram",
      name: "Lipidogram (cholesterol, HDL, LDL, TG)",
      frequencyMonths: age >= 40 ? 12 : 24,
      description: "Ocena profilu lipidowego, ryzyka miażdżycy i chorób sercowo-naczyniowych.",
      keywords: ["lipidogram", "cholesterol", "hdl", "ldl", "trojglicerydy"],
      source: "lab",
    },
    {
      id: "glukoza",
      name: "Glukoza na czczo",
      frequencyMonths: 12,
      description: "Badanie przesiewowe w kierunku cukrzycy i stanu przedcukrzycowego.",
      keywords: ["glukoza", "cukier"],
      source: "lab",
    },
    {
      id: "okulista",
      name: "Badanie okulistyczne / kontrola wzroku",
      frequencyMonths: 24,
      description: "Kontrola ostrości wzroku, pomiar ciśnienia śródgałkowego i badanie dna oka.",
      keywords: ["okulista", "okulistyczne", "wzrok"],
      source: "visit",
      specialization: "okulista",
    },
    {
      id: "stomatolog",
      name: "Przegląd stomatologiczny",
      frequencyMonths: 12,
      description: "Regularna kontrola stanu uzębienia i higieny jamy ustnej.",
      keywords: ["stomatolog", "dentysta", "plomba", "przeglad"],
      source: "dental",
    },
    {
      id: "usg_brzuch",
      name: "USG jamy brzusznej",
      frequencyMonths: 36,
      description: "Ocena narządów wewnętrznych: wątroby, trzustki, nerek, śledziony.",
      keywords: ["jama brzuszna", "usg jamy brzusznej", "usg brzucha"],
      source: "imaging",
    },
  ];

  if (isFemale) {
    list.push({
      id: "cytologia",
      name: "Cytologia",
      frequencyMonths: 24,
      description: "Przesiewowe badanie w kierunku raka szyjki macicy.",
      keywords: ["cytologia", "ginekolog"],
      source: "visit",
      specialization: "ginekolog",
    });
    if (age >= 50) {
      list.push({
        id: "mammografia",
        name: "Mammografia",
        frequencyMonths: 24,
        description: "Rentgenowskie badanie piersi w kierunku wczesnego wykrywania zmian nowotworowych.",
        keywords: ["mammografia", "piersi"],
        source: "imaging",
      });
    }
  } else {
    if (age >= 45) {
      list.push({
        id: "psa",
        name: "PSA (antygen swoisty dla stercza)",
        frequencyMonths: age >= 50 ? 12 : 24,
        description: "Badanie krwi ułatwiające wczesne wykrywanie przerostu lub raka prostaty.",
        keywords: ["psa", "urolog"],
        source: "lab",
      });
    }
  }

  return list.map((rec) => {
    let lastDate: Date | null = null;

    if (rec.source === "lab") {
      const matches = documents.filter((doc) => {
        const title = doc.title.toLowerCase();
        const hasKeyword = rec.keywords.some((kw) => title.includes(kw));
        const hasParam = doc.parameters && Object.keys(doc.parameters).some((p) => rec.keywords.some((kw) => p.toLowerCase().includes(kw)));
        return hasKeyword || hasParam;
      });
      if (matches.length > 0) {
        matches.sort((a, b) => new Date(b.studyDate).getTime() - new Date(a.studyDate).getTime());
        lastDate = new Date(matches[0].studyDate);
      }
    } else if (rec.source === "imaging") {
      const matches = imaging.filter((img) => {
        const title = img.title.toLowerCase();
        const desc = (img.description || "").toLowerCase();
        return rec.keywords.some((kw) => title.includes(kw) || desc.includes(kw));
      });
      if (matches.length > 0) {
        matches.sort((a, b) => new Date(b.studyDate).getTime() - new Date(a.studyDate).getTime());
        lastDate = new Date(matches[0].studyDate);
      }
    } else if (rec.source === "visit") {
      const matches = visits.filter((v) => {
        const spec = (v.specialization || "").toLowerCase();
        const reason = (v.reason || "").toLowerCase();
        const isSpec = rec.specialization && spec.includes(rec.specialization.toLowerCase());
        const hasKeyword = rec.keywords.some((kw) => reason.includes(kw) || spec.includes(kw));
        return isSpec || hasKeyword;
      });
      if (matches.length > 0) {
        matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        lastDate = new Date(matches[0].date);
      }
    } else if (rec.source === "dental") {
      if (dental.length > 0) {
        const sortedDental = [...dental].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        lastDate = new Date(sortedDental[0].date);
      }
    }

    let status: "OK" | "WARN" | "NONE" = "NONE";
    let message = "Brak zarejestrowanego badania w systemie.";

    if (lastDate) {
      const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);

      if (diffMonths < rec.frequencyMonths) {
        status = "OK";
        message = `Aktualne (wykonano ${format(lastDate, "d MMMM yyyy", { locale: pl })})`;
      } else {
        status = "WARN";
        message = `Zalecane powtórzenie (ostatnio wykonano ${format(lastDate, "d MMMM yyyy", { locale: pl })} - ponad ${Math.floor(diffMonths)} mies. temu)`;
      }
    }

    return {
      ...rec,
      lastDate,
      status,
      message,
    };
  });
}




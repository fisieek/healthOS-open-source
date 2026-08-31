import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { HealthClient } from "./health-client";
import { listDictionaries } from "@/lib/services/medical-dictionaries";
import { sortVisitsDesc } from "@/lib/services/visit-dates";
import { getAgenda } from "@/lib/services/health-agenda";
import { DEFAULT_BIOMARKERS, matchBiomarker, parseNumericValue, mergeBiomarkersWithDefaults, getDefaultBiomarkersWithIds } from "@/lib/constants/biomarkers";
import { startOfDay, endOfDay } from "date-fns";

export const runtime = "nodejs";

export default async function ZdrowiePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  // `?bodyPart=<id>` otwiera od razu drill-down danej części ciała — używane
  // przez kalendarz i kafelek agendy, żeby kliknięcie prowadziło do konkretu.
  const sp = await searchParams;
  const initialBodyPartId = typeof sp.bodyPart === "string" ? sp.bodyPart : null;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // 1. Pobieranie wizyt, stomatologii, metryk dziennych, snu, suplementów, aktywności i treningów siłowych
  const [
    visitsRaw,
    dentalRecords,
    dailyMetrics,
    sleepSessions,
    medications,
    documents,
    supplements,
    todayIntakes,
    nutrients,
    activities,
    strengthWorkouts,
    userProfile,
    referrals,
    healthEvents,
    bodyParts,
    visitsDetailedRaw,
    documentsDetailed,
    dictionaries
  ] = await Promise.all([
    prisma.medicalVisit.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.dentalRecord.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: {
        dentistRef: { select: { id: true, name: true } },
        facilityRef: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.dailyMetric.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    prisma.sleepSession.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    prisma.medication.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
    }),
    prisma.healthDocument.findMany({
      where: { userId },
      orderBy: { studyDate: "desc" },
      include: {
        bodyPart: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true, status: true } },
        orderingDoctor: { select: { id: true, name: true, specialization: true } },
        performingDoctor: { select: { id: true, name: true, specialization: true } },
        facilityRef: { select: { id: true, name: true } },
        visit: { select: { id: true, date: true } },
      },
    }),
    prisma.supplement.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      include: {
        ingredients: {
          orderBy: { name: "asc" },
          include: { nutrient: { select: { id: true, slug: true, name: true } } },
        },
      },
    }),
    prisma.supplementIntake.findMany({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
      orderBy: { takenAt: "desc" },
    }),
    prisma.nutrient.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, slug: true, name: true, defaultUnit: true, rda: true, upperLimit: true, category: true },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { startedAt: "asc" },
    }),
    prisma.strengthWorkout.findMany({
      where: { userId },
      orderBy: { startedAt: "asc" },
      include: {
        exercises: {
          include: {
            sets: true,
          },
        },
      },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
    }),
    prisma.referral.findMany({
      where: { userId },
      orderBy: { issueDate: "desc" },
      include: {
        bodyPart: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true, status: true } },
        fulfilledByVisit: {
          select: { id: true, doctorName: true, date: true, plannedDate: true, status: true },
        },
        fulfilledByDocument: { select: { id: true, title: true, studyDate: true, status: true } },
      },
    }),
    prisma.healthEvent.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.bodyPart.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, notes: true },
    }),
    // Wizyty z relacjami — do inline widoku „wg części ciała" (szczegóły)
    prisma.medicalVisit.findMany({
      where: { userId, bodyPartId: { not: null } },
      orderBy: { date: "desc" },
      include: {
        doctorRef: { select: { id: true, name: true, specialization: true } },
        facilityRef: { select: { id: true, name: true } },
        episode: { select: { id: true, title: true, status: true } },
      },
    }),
    // Badania z relacjami — do inline widoku szczegółów części ciała
    prisma.healthDocument.findMany({
      where: { userId, bodyPartId: { not: null } },
      orderBy: [{ status: "asc" }, { studyDate: "desc" }],
      include: {
        episode: { select: { id: true, title: true, status: true } },
        orderingDoctor: { select: { id: true, name: true, specialization: true } },
        performingDoctor: { select: { id: true, name: true, specialization: true } },
        facilityRef: { select: { id: true, name: true } },
        visit: { select: { id: true, date: true } },
      },
    }),
    listDictionaries(userId),
  ]);

  // Agenda „co Cię czeka" — zbierana z pięciu źródeł (poz. 9 etap 1).
  const agenda = await getAgenda(userId);

  // `orderBy: { date: "desc" }` kłamie dla wizyt bez ustalonego terminu — ich `date`
  // to placeholder-dziś, więc wskakiwały pomiędzy dzisiejsze. Sortujemy w pamięci
  // po faktycznym terminie; wizyty bez terminu lądują na końcu.
  const visits = sortVisitsDesc(visitsRaw);
  const visitsDetailed = sortVisitsDesc(visitsDetailedRaw);

  const serializedMeds = medications.map((m) => ({
    id: m.id,
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    startDate: m.startDate.toISOString(),
    endDate: m.endDate?.toISOString() ?? null,
    notes: m.notes,
    episodeId: m.episodeId ?? null,
  }));

  const serializedDocs = documents.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    studyDate: d.studyDate.toISOString(),
    laboratory: d.laboratory,
    doctor: d.doctor,
    description: d.description,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    fileUrl: d.fileUrl,
    parameters: d.parameters as Record<string, { value: string; unit?: string }> | null,
    // Pola potrzebne do edycji i przypisania badania bez wchodzenia w drill-down
    status: d.status,
    plannedDate: d.plannedDate?.toISOString() ?? null,
    bodyPartId: d.bodyPartId,
    bodyPart: d.bodyPart,
    episodeId: d.episodeId,
    episode: d.episode,
    visitId: d.visitId,
    orderingDoctor: d.orderingDoctor,
    performingDoctor: d.performingDoctor,
    facilityRef: d.facilityRef,
  }));

  // Klasyfikacja: badania obrazowe (RTG/USG) vs wyniki badań.
  // Decyduje `type` — dopasowanie po tytule jest wyłącznie fallbackiem dla starych
  // rekordów zapisanych zanim formularz wymuszał sensowny rodzaj badania.
  const IMAGING_TYPES = new Set(["IMAGING", "IMAGING_REPORT"]);
  const NON_IMAGING_TYPES = new Set([
    "BLOOD_TEST",
    "HORMONES",
    "URINE_TEST",
    "GENETIC",
  ]);
  const isImaging = (doc: typeof serializedDocs[number]) => {
    const t = doc.type.toUpperCase();
    if (IMAGING_TYPES.has(t) || t.includes("OBRAZ")) return true;
    // Rodzaj jednoznacznie nieobrazowy — nie zgaduj z tytułu.
    if (NON_IMAGING_TYPES.has(t)) return false;

    // Fallback dla rekordów o nijakim `type` (np. "OTHER"): szukamy nazwy metody
    // jako osobnego słowa, żeby przypadkowy fragment tytułu nie klasyfikował badania.
    return /\b(RTG|USG|MRI|TK|REZONANS|RESONANS|RENTGEN|TOMOGRAFIA)\b/u.test(
      doc.title.toUpperCase()
    );
  };

  const imagingDocs = serializedDocs.filter(isImaging);
  const labDocs = serializedDocs.filter((d) => !isImaging(d));

  // Słownik placówek — unikalne nazwy z wizyt, stomatologii i badań (do autocomplete)
  const facilitySet = new Set<string>();
  for (const v of visits) {
    if (v.facility?.trim()) facilitySet.add(v.facility.trim());
  }
  for (const r of dentalRecords) {
    if (r.facility?.trim()) facilitySet.add(r.facility.trim());
  }
  for (const d of documents) {
    if (d.laboratory?.trim()) facilitySet.add(d.laboratory.trim());
  }
  const facilitySuggestions = Array.from(facilitySet).sort((a, b) => a.localeCompare(b, "pl"));

  // Biomarkery (Badania Krwi / Moczu)
  const biomarkersList = await getUserBiomarkers(userId);
  const bloodMarkers = buildBloodMarkers(documents, biomarkersList);

  const serializedDailyMetrics = dailyMetrics.map((m) => ({
    id: m.id,
    userId: m.userId,
    date: m.date.toISOString(),
    steps: m.steps,
    activeCalories: m.activeCalories,
    totalCalories: m.totalCalories,
    restingHr: m.restingHr,
    hrv: m.hrv,
    spo2: m.spo2,
    stressScore: m.stressScore,
    rawData: m.rawData,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const serializedSleepSessions = sleepSessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    date: s.date.toISOString(),
    bedAt: s.bedAt?.toISOString() ?? null,
    wakeAt: s.wakeAt?.toISOString() ?? null,
    totalMinutes: s.totalMinutes,
    deepMinutes: s.deepMinutes,
    remMinutes: s.remMinutes,
    lightMinutes: s.lightMinutes,
    awakeMinutes: s.awakeMinutes,
    efficiency: s.efficiency,
    rawData: s.rawData,
    createdAt: s.createdAt.toISOString(),
  }));

  const serializedSupplements = supplements.map((s) => ({
    id: s.id,
    name: s.name,
    productName: s.productName,
    company: s.company,
    dose: s.dose,
    servingSize: s.servingSize,
    servingUnit: s.servingUnit,
    goal: s.goal,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate?.toISOString() ?? null,
    notes: s.notes,
    ingredients: s.ingredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      percentDV: ing.percentDV,
      nutrientId: ing.nutrientId,
      nutrientName: ing.nutrient?.name ?? null,
    })),
  }));

  const serializedIntakes = todayIntakes.map((i) => ({
    id: i.id,
    supplementId: i.supplementId,
    portion: i.portion,
    takenAt: i.takenAt.toISOString(),
  }));

  const serializedActivities = activities.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    startedAt: a.startedAt.toISOString(),
    duration: a.duration,
    distance: a.distance,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    sufferScore: a.sufferScore,
  }));

  const serializedStrengthWorkouts = strengthWorkouts.map((w) => ({
    id: w.id,
    startedAt: w.startedAt.toISOString(),
    duration: w.duration,
    volume: w.volume,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      sets: e.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
      })),
    })),
  }));

  const serializedReferrals = referrals.map((r) => ({
    id: r.id,
    title: r.title,
    specialization: r.specialization,
    doctorName: r.doctorName,
    issueDate: r.issueDate.toISOString(),
    expiryDate: r.expiryDate?.toISOString() ?? null,
    code: r.code,
    notes: r.notes,
    isUsed: r.isUsed, // [legacy] — UI czyta `status`
    status: r.status as string,
    episodeId: r.episodeId ?? null,
    bodyPartId: r.bodyPartId ?? null,
    bodyPart: r.bodyPart ? { id: r.bodyPart.id, name: r.bodyPart.name } : null,
    episode: r.episode
      ? { id: r.episode.id, title: r.episode.title, status: r.episode.status as string }
      : null,
    fulfilledByVisit: r.fulfilledByVisit
      ? {
          id: r.fulfilledByVisit.id,
          doctorName: r.fulfilledByVisit.doctorName,
          date: r.fulfilledByVisit.date.toISOString(),
          plannedDate: r.fulfilledByVisit.plannedDate?.toISOString() ?? null,
          status: r.fulfilledByVisit.status as string,
        }
      : null,
    fulfilledByDocument: r.fulfilledByDocument
      ? {
          id: r.fulfilledByDocument.id,
          title: r.fulfilledByDocument.title,
          studyDate: r.fulfilledByDocument.studyDate.toISOString(),
          status: r.fulfilledByDocument.status as string,
        }
      : null,
  }));

  const serializedHealthEvents = healthEvents.map((e) => ({
    id: e.id,
    type: e.type,
    date: e.date.toISOString(),
    title: e.title,
    description: e.description,
    documentId: e.documentId,
  }));

  const userProfileData = userProfile ? {
    birthDate: userProfile.birthDate?.toISOString() ?? null,
    sex: userProfile.sex ?? null,
  } : null;

  // ─── Wizyty wg części ciała (inline w zakładce „Wizyty lekarskie") ───────────
  const bodyPartNameById = new Map(bodyParts.map((b) => [b.id, b.name]));

  // Słowniki dla formularzy — epizody trzeba zserializować (Date → ISO string).
  const serializedDictionaries = {
    ...dictionaries,
    episodes: dictionaries.episodes.map((e) => ({
      id: e.id,
      bodyPartId: e.bodyPartId,
      title: e.title,
      status: e.status as string,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate?.toISOString() ?? null,
    })),
    visits: dictionaries.visits.map((v) => ({
      id: v.id,
      date: v.date.toISOString(),
      plannedDate: v.plannedDate?.toISOString() ?? null,
      status: v.status as string,
      doctorName: v.doctorName,
      specialization: v.specialization ?? null,
      bodyPartId: v.bodyPartId ?? null,
      episodeId: v.episodeId ?? null,
    })),
  };

  // Liczniki epizodów per część ciała — do kafelków w siatce.
  const episodeCounts: Record<string, { active: number; resolved: number }> = {};
  for (const e of dictionaries.episodes) {
    const c = (episodeCounts[e.bodyPartId] ??= { active: 0, resolved: 0 });
    if (e.status === "RESOLVED") c.resolved++;
    else c.active++;
  }

  // Liczniki do siatki — z już pobranych `visits` i `documents`
  const examCounts: Record<string, { planned: number; done: number }> = {};
  let unassignedExams = 0;
  for (const d of documents) {
    if (!d.bodyPartId) {
      unassignedExams++;
      continue;
    }
    const c = (examCounts[d.bodyPartId] ??= { planned: 0, done: 0 });
    if (d.status === "PLANNED") c.planned++;
    else c.done++;
  }
  const visitCounts: Record<string, number> = {};
  for (const v of visits) {
    if (v.bodyPartId) visitCounts[v.bodyPartId] = (visitCounts[v.bodyPartId] ?? 0) + 1;
  }

  const bodyPartCards = bodyParts.map((b) => ({
    id: b.id,
    name: b.name,
    notes: b.notes,
    visitCount: visitCounts[b.id] ?? 0,
    plannedExams: examCounts[b.id]?.planned ?? 0,
    doneExams: examCounts[b.id]?.done ?? 0,
    activeEpisodes: episodeCounts[b.id]?.active ?? 0,
    resolvedEpisodes: episodeCounts[b.id]?.resolved ?? 0,
  }));

  // Mapa szczegółów per część ciała — do inline drill-downu (bez zmiany strony)
  const bodyPartDetails: Record<string, {
    bodyPart: { id: string; name: string; notes: string | null };
    episodes: any[];
    visits: any[];
    documents: any[];
    dentalRecords: any[];
  }> = {};
  for (const b of bodyParts) {
    bodyPartDetails[b.id] = {
      bodyPart: { id: b.id, name: b.name, notes: b.notes },
      episodes: serializedDictionaries.episodes.filter((e) => e.bodyPartId === b.id),
      visits: [],
      documents: [],
      dentalRecords: [],
    };
  }
  // Zabiegi stomatologiczne trafiają do drill-downu przez epizod — ząb nie jest
  // osobną częścią ciała (32 pozycje zaśmiecałyby słownik), więc epizod
  // stomatologiczny wisi na części ciała typu „Zęby" / „Jama ustna".
  const bodyPartIdByEpisode = new Map(
    dictionaries.episodes.map((e) => [e.id, e.bodyPartId])
  );
  for (const r of dentalRecords) {
    const bpId = r.episodeId ? bodyPartIdByEpisode.get(r.episodeId) : null;
    const detail = bpId ? bodyPartDetails[bpId] : null;
    if (!detail) continue;
    detail.dentalRecords.push({
      id: r.id,
      toothNumber: r.toothNumber,
      procedure: r.procedure,
      status: r.status as string,
      date: r.date.toISOString(),
      plannedDate: r.plannedDate?.toISOString() ?? null,
      notes: r.notes,
      episodeId: r.episodeId ?? null,
      dentistRef: r.dentistRef ? { id: r.dentistRef.id, name: r.dentistRef.name } : null,
      facilityRef: r.facilityRef ? { id: r.facilityRef.id, name: r.facilityRef.name } : null,
    });
  }

  for (const v of visitsDetailed) {
    const detail = v.bodyPartId ? bodyPartDetails[v.bodyPartId] : null;
    if (!detail) continue;
    detail.visits.push({
      id: v.id,
      date: v.date.toISOString(),
      plannedDate: v.plannedDate?.toISOString() ?? null,
      status: v.status,
      doctorName: v.doctorName,
      specialization: v.specialization,
      facility: v.facility,
      reason: v.reason,
      summary: v.summary,
      recommendations: v.recommendations,
      followUpDate: v.followUpDate?.toISOString() ?? null,
      followUpNote: v.followUpNote,
      doctorRef: v.doctorRef,
      facilityRef: v.facilityRef,
      episodeId: v.episodeId,
      episode: v.episode ?? null,
    });
  }
  for (const d of documentsDetailed) {
    const detail = d.bodyPartId ? bodyPartDetails[d.bodyPartId] : null;
    if (!detail) continue;
    detail.documents.push({
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      studyDate: d.studyDate.toISOString(),
      plannedDate: d.plannedDate?.toISOString() ?? null,
      description: d.description,
      fileUrl: d.fileUrl,
      parameters: d.parameters,
      bodyPart: { id: d.bodyPartId!, name: bodyPartNameById.get(d.bodyPartId!) ?? "" },
      orderingDoctor: d.orderingDoctor,
      performingDoctor: d.performingDoctor,
      facilityRef: d.facilityRef,
      visitId: d.visitId,
      visit: d.visit ? { id: d.visit.id, date: d.visit.date.toISOString() } : null,
      episodeId: d.episodeId,
      episode: d.episode ?? null,
    });
  }

  return (
    <HealthClient
      initialVisits={visits}
      initialDentalRecords={dentalRecords}
      initialMedications={serializedMeds}
      initialDocuments={labDocs}
      imagingDocs={imagingDocs}
      facilitySuggestions={facilitySuggestions}
      bloodMarkers={bloodMarkers}
      initialDailyMetrics={serializedDailyMetrics}
      initialSleepSessions={serializedSleepSessions}
      initialSupplements={serializedSupplements}
      initialTodayIntakes={serializedIntakes}
      nutrients={nutrients}
      activities={serializedActivities}
      strengthWorkouts={serializedStrengthWorkouts}
      initialReferrals={serializedReferrals}
      initialHealthEvents={serializedHealthEvents}
      userProfile={userProfileData}
      bodyPartCards={bodyPartCards}
      unassignedExams={unassignedExams}
      bodyPartDetails={bodyPartDetails}
      dictionaries={serializedDictionaries}
      agenda={agenda}
      initialBodyPartId={initialBodyPartId}
    />
  );
}

// ─── Pomocnicze Funkcje do Biomarkerów ─────────────────────────────────────────

async function getUserBiomarkers(userId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });
  const s = (profile?.settings as any) ?? {};
  
  const defaultWithIds = getDefaultBiomarkersWithIds();

  if (!s.biomarkers || !Array.isArray(s.biomarkers) || s.biomarkers.length === 0) {
    await prisma.userProfile.upsert({
      where: { userId },
      update: { settings: { ...s, biomarkers: defaultWithIds } as any },
      create: { userId, settings: { biomarkers: defaultWithIds } as any },
    });
    return defaultWithIds;
  }

  // Bezpieczny merge: dodaje brakujące pozycje I uzupełnia brakujące pola
  // (np. nowo wprowadzony qualitativeNorm) bez nadpisywania wartości użytkownika.
  const existing = s.biomarkers as any[];
  const { merged, changed } = mergeBiomarkersWithDefaults(existing, defaultWithIds);

  if (changed) {
    await prisma.userProfile.update({
      where: { userId },
      data: { settings: { ...s, biomarkers: merged } as any },
    });
  }
  return merged;
}

function getBaseName(name: string): string {
  // Usuwa "(mmol/l)", "(mg/dl)", "(g/dl)", "(tys/µl)" itp. z końca nazwy
  return name.replace(/\s*\((mmol\/l|mg\/dl|g\/dl|tys\/µl|mln\/µl|fl|pg|%)\)$/i, "").trim();
}

function getCanonicalUnit(unit: string): { canonical: string; display: string } {
  const norm = unit.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Grupa tys/µl i G/l (stosunek 1:1)
  if (
    norm === "tys/µl" ||
    norm === "tys/ul" ||
    norm === "tys./µl" ||
    norm === "tys./ul" ||
    norm === "g/l" ||
    norm === "10^9/l" ||
    norm === "10^3/µl" ||
    norm === "10^3/ul"
  ) {
    return { canonical: "tys_ul", display: "tys/µl (G/l)" };
  }

  // 2. Grupa mln/µl i T/l (stosunek 1:1)
  if (
    norm === "mln/µl" ||
    norm === "mln/ul" ||
    norm === "mln./µl" ||
    norm === "mln./ul" ||
    norm === "t/l" ||
    norm === "10^12/l" ||
    norm === "10^6/µl" ||
    norm === "10^6/ul"
  ) {
    return { canonical: "mln_ul", display: "mln/µl (T/l)" };
  }

  // 3. Typowe odmiany pisowni (wielkość liter, greckie litery)
  if (norm === "µiu/ml" || norm === "uiu/ml" || norm === "miu/l") {
    return { canonical: "µiu_ml", display: "µIU/ml" };
  }
  if (norm === "ng/ml" || norm === "µg/l" || norm === "ug/l") {
    return { canonical: "ng_ml", display: "ng/ml" };
  }
  if (norm === "µg/dl" || norm === "ug/dl") {
    return { canonical: "µg_dl", display: "µg/dl" };
  }
  if (norm === "ng/dl") {
    return { canonical: "ng_dl", display: "ng/dl" };
  }
  if (norm === "mg/dl") {
    return { canonical: "mg_dl", display: "mg/dl" };
  }
  // mg/l i µg/ml to ta sama skala liczbowa (1 mg/l = 1 µg/ml)
  if (norm === "mg/l" || norm === "µg/ml" || norm === "ug/ml") {
    return { canonical: "mg_l", display: "mg/l" };
  }
  // pg/ml i ng/l to ta sama skala liczbowa (1 pg/ml = 1 ng/l)
  if (norm === "pg/ml" || norm === "ng/l") {
    return { canonical: "pg_ml", display: "pg/ml" };
  }
  if (norm === "mmol/l") {
    return { canonical: "mmol_l", display: "mmol/l" };
  }
  if (norm === "µmol/l" || norm === "umol/l") {
    return { canonical: "µmol_l", display: "µmol/l" };
  }
  if (norm === "u/l" || norm === "iu/l") {
    return { canonical: "u_l", display: "U/l" };
  }

  return { canonical: norm, display: unit };
}

export type MarkerStatus = "NORMAL" | "HIGH" | "LOW" | "UNKNOWN";

/**
 * Czy wynik podany w `resultUnit` wolno porównać z normą wyrażoną w `normUnit`.
 *
 * Zgodność liczymy przez `getCanonicalUnit`, żeby było jedno źródło prawdy:
 * ta sama funkcja grupuje krzywe na wykresie i decyduje o ocenie. Jednostki
 * o różnych skalach (masowa `ng/dl` vs molowa `pmol/l`) mają różne klucze
 * kanoniczne, więc porównanie jest odrzucane zamiast dawać fałszywe
 * „poza normą".
 */
function unitsComparable(resultUnit: string, normUnit: string): boolean {
  // Brak jednostki po którejkolwiek stronie = przyjmujemy jednostkę słownika.
  if (!resultUnit.trim() || !normUnit.trim()) return true;
  return getCanonicalUnit(resultUnit).canonical === getCanonicalUnit(normUnit).canonical;
}

function buildBloodMarkers(documents: any[], biomarkersList: any[]) {
  const markersMap: Record<string, {
    name: string;
    category: string;
    curves: Record<string, {
      unit: string;
      norm: string;
      /** Jednostka, w której wyrażona jest norma (ze słownika). */
      normUnit: string;
      latestValue: number;
      status: MarkerStatus;
      history: { date: string; value: number }[];
      lastStudyTime: number;
    }>;
  }> = {};

  // Sortujemy dokumenty chronologicznie
  const sortedDocs = [...documents].sort(
    (a, b) => new Date(a.studyDate).getTime() - new Date(b.studyDate).getTime()
  );

  for (const doc of sortedDocs) {
    if (!doc.parameters) continue;
    const params = doc.parameters as Record<string, { value: string; unit?: string }>;
    const dateStr = new Date(doc.studyDate).toISOString().split("T")[0];
    const studyTime = new Date(doc.studyDate).getTime();

    for (const [name, data] of Object.entries(params)) {
      const numVal = parseNumericValue(data.value);
      if (isNaN(numVal)) continue;

      const dictMarker = matchBiomarker(name, biomarkersList, data.unit);

      const normMin = dictMarker?.normMin ?? null;
      const normMax = dictMarker?.normMax ?? null;
      const unit = data.unit || dictMarker?.unit || "";

      let normStr = "—";
      if (normMin != null && normMax != null) {
        normStr = `${normMin} - ${normMax}`;
      } else if (normMin != null) {
        normStr = `>= ${normMin}`;
      } else if (normMax != null) {
        normStr = `<= ${normMax}`;
      }

      // Oceniamy TYLKO gdy jednostka wyniku zgadza się z jednostką normy.
      // Inaczej „poza normą" wynikałoby z przelicznika, a nie z wyniku pacjenta
      // (FT4 12.1 pmol/l vs norma 0.93–1.7 ng/dl). Ten sam błąd naprawiliśmy
      // wcześniej w evaluateParameters() w lib/services/episode-report.ts.
      const unitsOk = unitsComparable(data.unit || "", dictMarker?.unit || "");
      const normUnit = dictMarker?.unit || unit;

      let status: MarkerStatus = "NORMAL";
      if (!unitsOk) status = "UNKNOWN";
      else if (normMin != null && numVal < normMin) status = "LOW";
      else if (normMax != null && numVal > normMax) status = "HIGH";

      const finalName = dictMarker?.name || name;
      const baseName = getBaseName(finalName);
      const category = dictMarker?.category || "Inne";

      if (!markersMap[baseName]) {
        markersMap[baseName] = {
          name: baseName,
          category,
          curves: {},
        };
      }

      const { canonical, display } = getCanonicalUnit(unit);

      if (!markersMap[baseName].curves[canonical]) {
        markersMap[baseName].curves[canonical] = {
          unit: display,
          norm: normStr,
          normUnit,
          latestValue: numVal,
          status,
          history: [],
          lastStudyTime: studyTime,
        };
      }

      const curve = markersMap[baseName].curves[canonical];
      curve.latestValue = numVal;
      curve.status = status;
      curve.norm = normStr;
      curve.normUnit = normUnit;
      if (studyTime >= curve.lastStudyTime) {
        curve.lastStudyTime = studyTime;
      }
      curve.history.push({
        date: dateStr,
        value: numVal,
      });
    }
  }

  // Przetwarzamy zebrane dane na ostateczną tablicę
  const resultList = Object.values(markersMap).map((m) => {
    const curvesList = Object.values(m.curves).sort((a, b) => b.lastStudyTime - a.lastStudyTime);
    
    // Najnowsza krzywa określa ogólny stan biomarkera wyświetlany na lewej liście
    const latestCurve = curvesList[0];

    return {
      name: m.name,
      category: m.category,
      latestValue: latestCurve.latestValue,
      unit: latestCurve.unit,
      norm: latestCurve.norm,
      normUnit: latestCurve.normUnit,
      status: latestCurve.status,
      curves: curvesList.map(c => ({
        unit: c.unit,
        norm: c.norm,
        normUnit: c.normUnit,
        latestValue: c.latestValue,
        status: c.status,
        history: c.history,
      })),
    };
  });

  return resultList.sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

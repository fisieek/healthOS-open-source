import { prisma } from "@/lib/db";
import { ActivityType, IntensityClass } from "@/app/generated/prisma/client";

interface ParsedEvent {
  uid: string;
  dtstart: string;
  summary: string;
  description: string;
  duration: number | null;
}

function parseICS(icsContent: string): ParsedEvent[] {
  // Odwijanie linii (unfolding) - w formacie iCalendar długie linie mogą być dzielone
  // na kolejne zaczynające się od spacji lub tabulatora.
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  
  const events: ParsedEvent[] = [];
  let currentEvent: Partial<ParsedEvent> | null = null;
  
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      currentEvent = {};
    } else if (line.startsWith("END:VEVENT")) {
      if (currentEvent && currentEvent.uid) {
        events.push(currentEvent as ParsedEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const key = line.substring(0, colonIdx);
        const val = line.substring(colonIdx + 1);
        
        // Zabezpieczenie przed parametrami w kluczach, np. DTSTART;VALUE=DATE
        const baseKey = key.split(";")[0];
        
        if (baseKey === "UID") {
          currentEvent.uid = val;
        } else if (baseKey === "DTSTART") {
          currentEvent.dtstart = val;
        } else if (baseKey === "SUMMARY") {
          currentEvent.summary = val;
        } else if (baseKey === "DESCRIPTION") {
          currentEvent.description = val;
        } else if (baseKey === "X-WORKOUT-ESTIMATED-DURATION") {
          currentEvent.duration = parseInt(val, 10) || null;
        }
      }
    }
  }
  return events;
}

export async function syncRunnaCalendar(userId: string): Promise<{ synced: number; removed: number; skipped: number }> {
  // 1. Pobranie profilu użytkownika w celu wyciągnięcia URL kalendarza
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });

  const settings = (profile?.settings ?? {}) as Record<string, any>;
  const calendarUrl = settings.runnaCalendarUrl;

  if (!calendarUrl) {
    throw new Error("Link do kalendarza Runna nie został skonfigurowany w profilu.");
  }

  // 2. Pobranie feedu ICS
  const response = await fetch(calendarUrl);
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać kalendarza Runna. Kod błędu: ${response.status}`);
  }
  const icsText = await response.text();

  // 3. Parsowanie zdarzeń
  const allEvents = parseICS(icsText);
  
  // Filtrujemy tylko zaplanowane treningi (pomijamy ukończone COMPLETED_)
  const upcomingEvents = allEvents.filter(ev => ev.uid.startsWith("UPCOMING_PLAN_WORKOUT-"));

  let synced = 0;
  let skipped = 0;

  // 4. Ingestowanie treningów (upsert)
  for (const ev of upcomingEvents) {
    // Parsowanie daty (DTSTART np. 20260526)
    if (!ev.dtstart || ev.dtstart.length < 8) {
      skipped++;
      continue;
    }
    const year = parseInt(ev.dtstart.substring(0, 4), 10);
    const month = parseInt(ev.dtstart.substring(4, 6), 10) - 1;
    const day = parseInt(ev.dtstart.substring(6, 8), 10);
    const date = new Date(year, month, day);

    // Oczyszczenie nazwy (usuwamy emoji biegacza)
    const name = ev.summary ? ev.summary.replace(/^🏃\s*/, "").trim() : "Trening biegowy";

    // Wyciąganie dystansu w metrach
    let targetDistance: number | null = null;
    const distMatch = ev.summary ? ev.summary.match(/•\s*(\d+(?:\.\d+)?)\s*km/i) : null;
    if (distMatch) {
      targetDistance = parseFloat(distMatch[1]) * 1000;
    } else {
      const distMatch2 = ev.summary ? ev.summary.match(/(\d+(?:\.\d+)?)\s*km/i) : null;
      if (distMatch2) {
        targetDistance = parseFloat(distMatch2[1]) * 1000;
      }
    }

    // Wyciąganie notatek i usuwanie linku do apki na końcu
    let notes = ev.description ? ev.description.replace(/\\n/g, "\n").trim() : null;
    if (notes) {
      notes = notes.replace(/\s*📲\s*View in the Runna app:[\s\S]*$/, "").trim();
    }

    // Dobór klasy intensywności
    let intensityClass: IntensityClass = IntensityClass.OTHER;
    const uidUpper = ev.uid.toUpperCase();
    if (uidUpper.includes("EASY_RUN")) {
      intensityClass = IntensityClass.EASY;
    } else if (uidUpper.includes("LONG_RUN")) {
      intensityClass = IntensityClass.LONG;
    } else if (uidUpper.includes("INTERVALS") || uidUpper.includes("TAPER_INTERVALS")) {
      intensityClass = IntensityClass.INTERVAL;
    } else if (uidUpper.includes("TEMPO")) {
      intensityClass = IntensityClass.TEMPO;
    } else if (uidUpper.includes("RACE")) {
      intensityClass = IntensityClass.RACE;
    } else if (uidUpper.includes("RECOVERY")) {
      intensityClass = IntensityClass.RECOVERY;
    } else if (uidUpper.includes("STEADY")) {
      intensityClass = IntensityClass.STEADY;
    } else if (uidUpper.includes("THRESHOLD")) {
      intensityClass = IntensityClass.THRESHOLD;
    }

    // Wyszukaj istniejący rekord (indeks złożony z polem nullable uniemożliwia upsert w Prisma)
    const existing = await prisma.trainingPlanSession.findFirst({
      where: {
        userId,
        sourceId: ev.uid,
      },
    });

    if (existing) {
      await prisma.trainingPlanSession.update({
        where: { id: existing.id },
        data: {
          date,
          name,
          targetDistance,
          targetDuration: ev.duration,
          notes,
          intensityClass,
        },
      });
    } else {
      await prisma.trainingPlanSession.create({
        data: {
          userId,
          sourceId: ev.uid,
          source: "RUNNA",
          date,
          type: ActivityType.RUN,
          name,
          targetDistance,
          targetDuration: ev.duration,
          notes,
          intensityClass,
        },
      });
    }

    synced++;
  }

  // 5. Agresywna synchronizacja - usuwanie starych sesji Runna, których nie ma już w feedzie,
  // ale nie dotykamy tych, które mają manualne dopasowanie/override.
  const currentSourceIds = upcomingEvents.map(ev => ev.uid);
  
  const sessionsToDelete = await prisma.trainingPlanSession.findMany({
    where: {
      userId,
      source: "RUNNA",
      sourceId: { notIn: currentSourceIds },
    },
    include: {
      statuses: true,
    },
  });

  const toDeleteIds = (sessionsToDelete as any[])
    .filter(s => !s.statuses?.some((st: any) => st.overriddenAt !== null))
    .map(s => s.id);

  let removed = 0;
  if (toDeleteIds.length > 0) {
    const delResult = await prisma.trainingPlanSession.deleteMany({
      where: {
        id: { in: toDeleteIds },
      },
    });
    removed = delResult.count;
  }

  // 6. Aktualizacja daty ostatniej synchronizacji w profilu
  settings.runnaLastSyncedAt = new Date().toISOString();
  await prisma.userProfile.update({
    where: { userId },
    data: { settings },
  });

  return { synced, removed, skipped };
}

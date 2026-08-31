import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncToGoogleCalendar } from "@/lib/services/calendar-sync";
import { collectAgendaItems } from "@/lib/services/health-agenda";
import {
  buildCalendarEvent,
  withinSyncWindow,
  type CalendarEvent,
} from "@/lib/constants/calendar-events";

export const runtime = "nodejs";

export interface SyncPreviewRow {
  agendaItemId: string;
  kind: string;
  event: CalendarEvent;
}

export interface SyncPreview {
  /** Pozycje, które trafiłyby do Google — dokładnie w takiej formie. */
  rows: SyncPreviewRow[];
  /** Pozycje pominięte i dlaczego — żeby brak zdarzenia nie był zagadką. */
  skipped: { agendaItemId: string; kind: string; reason: string }[];
}

/**
 * Podgląd synchronizacji: **co dokładnie zobaczysz w Kalendarzu Google**.
 *
 * Celowo nie wymaga podłączonego konta Google ani żadnych tokenów — to jest
 * ekran „wyślę N zdarzeń" z planu, który ma być do obejrzenia ZANIM cokolwiek
 * opuści ten komputer. Nic tu nie wychodzi na zewnątrz; liczymy lokalnie.
 *
 * Właściwy wysył to `POST` na tę samą trasę (dokładany w kolejnym kroku).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await collectAgendaItems(session.user.id);
  const now = new Date();

  const rows: SyncPreviewRow[] = [];
  const skipped: SyncPreview["skipped"] = [];

  for (const item of items) {
    if (!item.date) {
      skipped.push({
        agendaItemId: item.id,
        kind: item.kind,
        reason: "termin nieustalony",
      });
      continue;
    }
    if (!withinSyncWindow(item, now)) {
      skipped.push({
        agendaItemId: item.id,
        kind: item.kind,
        reason: "poza oknem (−30 dni / +12 miesięcy)",
      });
      continue;
    }
    const event = buildCalendarEvent(item);
    if (!event) continue;
    rows.push({ agendaItemId: item.id, kind: item.kind, event });
  }

  rows.sort((a, b) => a.event.start.date.localeCompare(b.event.start.date));

  return NextResponse.json({ rows, skipped } satisfies SyncPreview);
}

/**
 * Właściwy wysył. Osobny czasownik od podglądu, bo to jedyny moment, w którym
 * dane naprawdę opuszczają ten komputer — `GET` musi być bezpieczny do kliknięcia.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncToGoogleCalendar(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Google Calendar sync error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Synchronizacja nie powiodła się" },
      { status: 500 }
    );
  }
}

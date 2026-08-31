import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma";
import { collectAgendaItems } from "@/lib/services/health-agenda";
import {
  buildCalendarEvent,
  hashEvent,
  withinSyncWindow,
} from "@/lib/constants/calendar-events";
import {
  deleteEvent,
  ensureHealthCalendar,
  getGoogleCredentials,
  getValidAccessToken,
  insertEvent,
  updateEvent,
} from "@/lib/services/google-calendar";

/**
 * Synchronizacja healthOS → Kalendarz Google (poz. 9 etap 4).
 *
 * **Jednokierunkowo.** Google jest widokiem, nie źródłem prawdy: zmiana
 * zdarzenia po tamtej stronie nie wraca do aplikacji. Dwukierunkowość wymaga
 * rozwiązywania konfliktów i webhooków — przy kilku zdarzeniach na miesiąc
 * nieproporcjonalne do zysku.
 */

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  errors: string[];
}

export async function syncToGoogleCalendar(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    errors: [],
  };

  const creds = await getGoogleCredentials(userId);
  if (!creds) throw new Error("Brak danych dostępowych Google");

  const startedAt = new Date();
  const token = await getValidAccessToken(userId, creds.clientId, creds.clientSecret);
  const calendarId = await ensureHealthCalendar(userId, token);

  // ── Stan pożądany: co POWINNO być w kalendarzu ──
  const items = await collectAgendaItems(userId);
  const now = new Date();
  const wanted = new Map<string, ReturnType<typeof buildCalendarEvent>>();
  for (const item of items) {
    if (!withinSyncWindow(item, now)) continue;
    const event = buildCalendarEvent(item);
    if (event) wanted.set(item.id, event);
  }

  // ── Stan faktyczny: co już wysłaliśmy ──
  const existing = await prisma.calendarSync.findMany({ where: { userId } });
  const byItemId = new Map(existing.map((e) => [e.agendaItemId, e]));

  // ── Nowe i zmienione ──
  for (const [agendaItemId, event] of wanted) {
    if (!event) continue;
    const hash = hashEvent(event);
    const known = byItemId.get(agendaItemId);

    try {
      if (!known) {
        const googleEventId = await insertEvent(token, calendarId, event);
        await prisma.calendarSync.create({
          data: {
            userId,
            agendaItemId,
            googleEventId,
            googleCalendarId: calendarId,
            lastHash: hash,
            lastPushedAt: new Date(),
          },
        });
        result.created++;
      } else if (known.lastHash !== hash || known.googleCalendarId !== calendarId) {
        // Zmiana terminu MODYFIKUJE istniejące zdarzenie zamiast tworzyć drugie —
        // to jest cały sens trzymania `googleEventId`.
        await updateEvent(token, calendarId, known.googleEventId, event);
        await prisma.calendarSync.update({
          where: { id: known.id },
          data: { lastHash: hash, googleCalendarId: calendarId, lastPushedAt: new Date() },
        });
        result.updated++;
      } else {
        result.unchanged++;
      }
    } catch (err) {
      result.errors.push(`${agendaItemId}: ${(err as Error).message}`);
    }
  }

  // ── Zniknięte: pozycja skasowana, zrealizowana albo wypadła z okna ──
  for (const known of existing) {
    if (wanted.has(known.agendaItemId)) continue;
    try {
      await deleteEvent(token, known.googleCalendarId, known.googleEventId);
      await prisma.calendarSync.delete({ where: { id: known.id } });
      result.deleted++;
    } catch (err) {
      result.errors.push(`${known.agendaItemId}: ${(err as Error).message}`);
    }
  }

  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
    select: { id: true },
  });

  await prisma.dataSource.update({
    where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
    data: { lastSyncedAt: new Date(), isActive: true },
  });

  await prisma.syncLog.create({
    data: {
      userId,
      dataSourceId: source?.id ?? null,
      triggeredBy: "manual",
      status: result.errors.length === 0 ? "success" : "partial",
      itemsSynced: result.created + result.updated + result.deleted,
      error: result.errors.length ? result.errors.join("; ").slice(0, 1000) : null,
      startedAt,
      finishedAt: new Date(),
    },
  });

  return result;
}

/**
 * Kasuje w Google wszystko, co wysłaliśmy. Używane przy „Rozłącz", gdy
 * użytkownik chce posprzątać po sobie.
 */
export async function removeAllSyncedEvents(userId: string): Promise<number> {
  const creds = await getGoogleCredentials(userId);
  if (!creds) return 0;

  const token = await getValidAccessToken(userId, creds.clientId, creds.clientSecret);
  const existing = await prisma.calendarSync.findMany({ where: { userId } });

  let removed = 0;
  for (const row of existing) {
    try {
      await deleteEvent(token, row.googleCalendarId, row.googleEventId);
      removed++;
    } catch {
      // Zdarzenie mogło już nie istnieć — i tak czyścimy wpis lokalny.
    }
  }
  await prisma.calendarSync.deleteMany({ where: { userId } });
  return removed;
}

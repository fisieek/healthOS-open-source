import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma";
import { revokeToken } from "@/lib/services/google-calendar";
import { removeAllSyncedEvents } from "@/lib/services/calendar-sync";

export const runtime = "nodejs";

/**
 * Rozłączenie konta Google.
 *
 * `?removeEvents=1` dodatkowo kasuje wszystko, co wysłaliśmy. Nie robimy tego
 * domyślnie: użytkownik mógł już poukładać wokół tych terminów swój tydzień,
 * a ciche usunięcie wpisów z kalendarza byłoby niespodzianką. Pytamy w UI.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const removeEvents = req.nextUrl.searchParams.get("removeEvents") === "1";
  let removed = 0;

  if (removeEvents) {
    try {
      removed = await removeAllSyncedEvents(session.user.id);
    } catch (err) {
      console.error("Nie udało się posprzątać zdarzeń:", err);
      // Lecimy dalej — rozłączenie ma się udać nawet, gdy Google nie odpowiada.
    }
  }

  const source = await prisma.dataSource.findUnique({
    where: {
      userId_type: { userId: session.user.id, type: DataSourceType.GOOGLE_CALENDAR },
    },
    select: { accessToken: true },
  });

  if (source?.accessToken) await revokeToken(source.accessToken);

  // Kasujemy powiązania, nawet gdy zdarzeń nie sprzątaliśmy — bez tokenów i tak
  // nie mamy jak nimi zarządzać, a nieaktualne wpisy myliłyby przy ponownym
  // podłączeniu (próbowalibyśmy aktualizować cudze/nieistniejące zdarzenia).
  await prisma.calendarSync.deleteMany({ where: { userId: session.user.id } });

  await prisma.dataSource.deleteMany({
    where: { userId: session.user.id, type: DataSourceType.GOOGLE_CALENDAR },
  });

  return NextResponse.json({ ok: true, removed });
}

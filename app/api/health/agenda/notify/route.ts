import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getAgenda } from "@/lib/services/health-agenda";
import {
  buildNotificationMessage,
  parseNotificationPrefs,
} from "@/lib/constants/notifications";

export const runtime = "nodejs";

/**
 * Treść powiadomienia desktopowego dla **zalogowanego** użytkownika (poz. 9 etap 3).
 *
 * Woła to proces główny Electrona, przekazując ciasteczko sesji z okna aplikacji.
 * Dzięki temu nie ma osobnego sekretu ani zgadywania, o które konto chodzi —
 * powiadomienie dotyczy tego, kto jest zalogowany. Gdy nikt nie jest — 401
 * i Electron po prostu nic nie pokazuje.
 *
 * Logika agendy zostaje w `getAgenda()`; tutaj tylko przycinamy ją do horyzontu
 * z ustawień i składamy tekst. Żadnego duplikowania reguł „co jest zaległe".
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const settings = (profile?.settings ?? {}) as Record<string, unknown>;
  const prefs = parseNotificationPrefs(settings.desktopNotifications);

  // Adres służy Electronowi za klucz stanu „już powiadomiono" w config.json —
  // jedna instalacja może obsługiwać kilka kont.
  const account = session.user.email ?? session.user.id;

  if (!prefs.enabled) {
    return NextResponse.json({ account, prefs, message: null });
  }

  // Horyzont = wyprzedzenie z ustawień. Panel agendy patrzy 30 dni naprzód,
  // ale dymek ma mówić o tym, co naprawdę zaraz, a nie o całym miesiącu.
  const { overdue, upcoming } = await getAgenda(session.user.id, {
    horizonDays: prefs.leadDays,
  });

  return NextResponse.json({
    account,
    prefs,
    message: buildNotificationMessage(overdue, upcoming),
  });
}

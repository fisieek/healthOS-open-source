import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma";
import { parseNotificationPrefs } from "@/lib/constants/notifications";

export const runtime = "nodejs";

/**
 * Ustawienia powiadomień desktopowych (poz. 9 etap 3).
 *
 * Trzymamy je w `UserProfile.settings` — tak jak `geminiApiKey` — bo są
 * **per konto**, a jedna instalacja obsługuje kilka. W `config.json` zostaje
 * wyłącznie stan „kiedy ostatnio powiadomiono", czyli rzecz lokalna dla
 * instalacji, nie dla użytkownika.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  // Walidacja i normalizacja w jednym miejscu — ta sama funkcja czyta te dane
  // z powrotem w trasie powiadomień, więc nie da się zapisać czegoś,
  // czego odczyt nie zaakceptuje.
  const prefs = parseNotificationPrefs(body);

  const existing = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const settings = (existing?.settings ?? {}) as Record<string, unknown>;
  settings.desktopNotifications = prefs;

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      settings: settings as Prisma.InputJsonValue,
    },
    update: { settings: settings as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true, prefs });
}

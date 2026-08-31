import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isValidRunnaCalendarUrl, RUNNA_URL_HINT } from "@/lib/services/runna-url";

export const runtime = "nodejs";

// PUT /api/settings/runna
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { calendarUrl } = await request.json();

    if (!calendarUrl) {
      return Response.json({ error: "URL kalendarza jest wymagany" }, { status: 400 });
    }

    if (typeof calendarUrl !== "string" || !isValidRunnaCalendarUrl(calendarUrl)) {
      return Response.json({ error: `Nieprawidłowy adres kalendarza. ${RUNNA_URL_HINT}` }, { status: 400 });
    }

    const userId = session.user.id;

    // Pobierz lub utwórz profil
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const settings = (profile?.settings ?? {}) as Record<string, any>;
    settings.runnaCalendarUrl = calendarUrl;

    await prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        settings,
      },
      update: {
        settings,
      },
    });

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Błąd zapisu ustawień Runna";
    return Response.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/settings/runna
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (profile) {
      const settings = (profile.settings ?? {}) as Record<string, any>;
      delete settings.runnaCalendarUrl;
      delete settings.runnaLastSyncedAt;

      await prisma.userProfile.update({
        where: { userId },
        data: { settings },
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Błąd usuwania ustawień Runna";
    return Response.json({ error: message }, { status: 500 });
  }
}

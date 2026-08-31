import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { calculateVdot } from "@/lib/services/intensity";
import { ActivityType, DataSourceType, IntensityClass } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/bieg/manual
 * Tworzy ręczny rekord biegu w bazie danych (na podstawie danych wprowadzonych
 * lub wyekstrahowanych ze zdjęcia i zweryfikowanych przez użytkownika).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      distanceKm,
      durationSec,
      avgHr,
      maxHr,
      calories,
      elevGain,
      date,
      deviceName,
      notes,
      zoneMinutes,
      intensityClass,
    } = body;

    if (!distanceKm || !durationSec || !date) {
      return Response.json(
        { error: "Pola 'distanceKm', 'durationSec' oraz 'date' są wymagane." },
        { status: 400 }
      );
    }

    const distMeters = Math.round(parseFloat(distanceKm) * 1000);
    const durSec = parseInt(durationSec);

    // Wyliczenie tempa (sekundy na kilometr) i prędkości (m/s)
    const avgPace = distMeters > 0 ? (durSec / (distMeters / 1000)) : 0;
    const avgSpeed = durSec > 0 ? (distMeters / durSec) : 0;

    // Próba oszacowania Daniels VDOT
    const vdotEstimate = calculateVdot(distMeters, durSec);

    // Formatowanie daty - standardowo południe (12:00) lokalnego czasu na dany dzień
    const startedAt = new Date(`${date}T12:00:00`);

    // Nazwa biegu
    const formattedDistance = parseFloat(distanceKm).toFixed(2);
    const name = `Bieg manualny ${formattedDistance} km`;

    // Budowa obiektu zoneMinutes
    let finalZoneMinutes: any = null;
    if (zoneMinutes && typeof zoneMinutes === "object") {
      finalZoneMinutes = {
        z1: zoneMinutes.z1 ? parseInt(zoneMinutes.z1) : 0,
        z2: zoneMinutes.z2 ? parseInt(zoneMinutes.z2) : 0,
        z3: zoneMinutes.z3 ? parseInt(zoneMinutes.z3) : 0,
        z4: zoneMinutes.z4 ? parseInt(zoneMinutes.z4) : 0,
        z5: zoneMinutes.z5 ? parseInt(zoneMinutes.z5) : 0,
      };
    }

    // Walidacja klasy intensywności
    let finalIntensity: IntensityClass = IntensityClass.EASY;
    if (intensityClass && Object.values(IntensityClass).includes(intensityClass)) {
      finalIntensity = intensityClass as IntensityClass;
    } else {
      // Heurystyka tętna
      if (avgHr && maxHr) {
        const ratio = avgHr / maxHr;
        if (ratio >= 0.92) finalIntensity = IntensityClass.INTERVAL;
        else if (ratio >= 0.85) finalIntensity = IntensityClass.THRESHOLD;
        else if (ratio >= 0.78) finalIntensity = IntensityClass.TEMPO;
        else if (durSec >= 90 * 60) finalIntensity = IntensityClass.LONG;
        else if (ratio >= 0.65) finalIntensity = IntensityClass.EASY;
        else if (ratio >= 0.5) finalIntensity = IntensityClass.RECOVERY;
      }
    }

    const activity = await prisma.activity.create({
      data: {
        userId: session.user.id,
        source: DataSourceType.MANUAL,
        type: ActivityType.RUN,
        name,
        startedAt,
        duration: durSec,
        elapsedTime: durSec,
        distance: distMeters,
        elevGain: elevGain ? parseFloat(elevGain) : null,
        avgHr: avgHr ? parseInt(avgHr) : null,
        maxHr: maxHr ? parseInt(maxHr) : null,
        avgPace,
        avgSpeed,
        calories: calories ? parseInt(calories) : null,
        description: notes || null,
        deviceName: deviceName || "Wgrane ręcznie (AI)",
        vdotEstimate,
        zoneMinutes: finalZoneMinutes,
        intensityClass: finalIntensity,
        intensityClassOverride: true, // Zablokowanie automatycznego nadpisywania klasy intensywności
      },
    });

    return Response.json({ success: true, activity }, { status: 201 });
  } catch (error: any) {
    console.error("Błąd zapisu manualnego biegu:", error);
    return Response.json(
      { error: error.message || "Wystąpił błąd podczas zapisu aktywności" },
      { status: 500 }
    );
  }
}

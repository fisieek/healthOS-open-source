import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/garmin/ingest
 *
 * Accepts data from the Garmin Connect sync script.
 * Protected by GARMIN_INGEST_SECRET bearer token.
 */

interface SleepInput {
  date: string;
  bedAt?: string | null;
  wakeAt?: string | null;
  totalMinutes?: number | null;
  deepMinutes?: number | null;
  remMinutes?: number | null;
  lightMinutes?: number | null;
  awakeMinutes?: number | null;
  efficiency?: number | null;
}

interface DailyMetricInput {
  date: string;
  steps?: number | null;
  restingHr?: number | null;
  hrv?: number | null;
  spo2?: number | null;
  stressScore?: number | null;
  activeCalories?: number | null;
  totalCalories?: number | null;
  bodyBatteryMax?: number | null;
  bodyBatteryMin?: number | null;
  bodyBatteryTrend?: any[] | null;
  stressTrend?: any[] | null;
  vo2max?: number | null;
}

interface ActivityInput {
  sourceId: string;
  name: string;
  type: "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "OTHER";
  startedAt: string;
  duration: number;
  elapsedTime?: number | null;
  distance?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  avgSpeed?: number | null;
  vo2max?: number | null;
  trainingEffectAerobic?: number | null;
  trainingEffectAnaerobic?: number | null;
  trainingLoad?: number | null;
}

interface HeartRateSampleInput {
  recordedAt: string;
  bpm: number;
  type?: string | null;
}

interface IngestPayload {
  userId: string;
  sleep?: SleepInput[];
  dailyMetrics?: DailyMetricInput[];
  activities?: ActivityInput[];
  heartRateSamples?: HeartRateSampleInput[];
}

export async function POST(request: Request) {
  try {
    // Auth: bearer token
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.GARMIN_INGEST_SECRET;

    // Bez ustawionego sekretu endpoint jest zamknięty. Wcześniej wchodziło tu
    // hasło zapasowe wpisane w kodzie — po opublikowaniu repozytorium znałby je
    // każdy, a ten endpoint pisze do bazy dowolnego konta. Ten sam wzorzec co
    // w /api/colmi/ingest.
    if (!expectedToken) {
      return Response.json(
        { error: "GARMIN_INGEST_SECRET not configured" },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as IngestPayload;

    if (!body.userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const results = {
      sleep: 0,
      dailyMetrics: 0,
      activities: 0,
      heartRateSamples: 0,
    };

    // 1. Sleep sessions
    if (body.sleep?.length) {
      for (const s of body.sleep) {
        const dateObj = new Date(s.date);
        await prisma.sleepSession.upsert({
          where: { userId_date: { userId: body.userId, date: dateObj } },
          create: {
            userId: body.userId,
            date: dateObj,
            bedAt: s.bedAt ? new Date(s.bedAt) : null,
            wakeAt: s.wakeAt ? new Date(s.wakeAt) : null,
            totalMinutes: s.totalMinutes ?? null,
            deepMinutes: s.deepMinutes ?? null,
            remMinutes: s.remMinutes ?? null,
            lightMinutes: s.lightMinutes ?? null,
            awakeMinutes: s.awakeMinutes ?? null,
            efficiency: s.efficiency ?? null,
            rawData: s as object,
          },
          update: {
            bedAt: s.bedAt ? new Date(s.bedAt) : null,
            wakeAt: s.wakeAt ? new Date(s.wakeAt) : null,
            totalMinutes: s.totalMinutes ?? null,
            deepMinutes: s.deepMinutes ?? null,
            remMinutes: s.remMinutes ?? null,
            lightMinutes: s.lightMinutes ?? null,
            awakeMinutes: s.awakeMinutes ?? null,
            efficiency: s.efficiency ?? null,
            rawData: s as object,
          },
        });
        results.sleep++;
      }
    }

    // 2. Daily metrics
    if (body.dailyMetrics?.length) {
      for (const m of body.dailyMetrics) {
        const dateObj = new Date(m.date);
        
        // Odczytaj istniejący DailyMetric, aby połączyć rawData
        const existing = await prisma.dailyMetric.findUnique({
          where: { userId_date: { userId: body.userId, date: dateObj } }
        });
        
        const existingRaw = existing && existing.rawData && typeof existing.rawData === "object"
          ? (existing.rawData as Record<string, any>)
          : {};

        const mergedRaw = {
          ...existingRaw,
          ...m,
          bodyBatteryMax: m.bodyBatteryMax ?? existingRaw.bodyBatteryMax ?? null,
          bodyBatteryMin: m.bodyBatteryMin ?? existingRaw.bodyBatteryMin ?? null,
          bodyBatteryTrend: m.bodyBatteryTrend ?? existingRaw.bodyBatteryTrend ?? [],
          stressTrend: m.stressTrend ?? existingRaw.stressTrend ?? [],
          vo2max: m.vo2max ?? existingRaw.vo2max ?? null
        };

        await prisma.dailyMetric.upsert({
          where: { userId_date: { userId: body.userId, date: dateObj } },
          create: {
            userId: body.userId,
            date: dateObj,
            steps: m.steps ?? null,
            restingHr: m.restingHr ?? null,
            hrv: m.hrv ?? null,
            spo2: m.spo2 ?? null,
            stressScore: m.stressScore ?? null,
            activeCalories: m.activeCalories ?? null,
            totalCalories: m.totalCalories ?? null,
            rawData: mergedRaw as object,
          },
          update: {
            ...(m.steps != null && { steps: m.steps }),
            ...(m.restingHr != null && { restingHr: m.restingHr }),
            ...(m.hrv != null && { hrv: m.hrv }),
            ...(m.spo2 != null && { spo2: m.spo2 }),
            ...(m.stressScore != null && { stressScore: m.stressScore }),
            ...(m.activeCalories != null && { activeCalories: m.activeCalories }),
            ...(m.totalCalories != null && { totalCalories: m.totalCalories }),
            rawData: mergedRaw as object,
          },
        });
        results.dailyMetrics++;
      }
    }

    // 3. Activities (z łączeniem nakładających się treningów)
    if (body.activities?.length) {
      for (const act of body.activities) {
        const startedAtDate = new Date(act.startedAt);

        // Szukamy istniejącej aktywności w podobnym oknie czasowym (+/- 10 minut rozpoczęcia)
        const tenMins = 10 * 60 * 1000;
        const matchingActivity = await prisma.activity.findFirst({
          where: {
            userId: body.userId,
            startedAt: {
              gte: new Date(startedAtDate.getTime() - tenMins),
              lte: new Date(startedAtDate.getTime() + tenMins),
            },
          },
        });

        if (matchingActivity) {
          // Istnieje nakładająca się aktywność (np. ze Strava)
          // Garmin jest nadrzędny dla tętna, dystansu, kalorii, VO2max i wskaźników obciążenia.
          // Aktualizujemy dane rekordu danymi z Garmina i ustawiamy go jako Garmin, zachowując jego ID i powiązania w bazie!
          const mergedRaw = {
            ...(matchingActivity.rawData && typeof matchingActivity.rawData === "object"
              ? (matchingActivity.rawData as Record<string, any>)
              : {}),
            garminSourceId: act.sourceId,
            trainingEffectAerobic: act.trainingEffectAerobic,
            trainingEffectAnaerobic: act.trainingEffectAnaerobic,
            trainingLoad: act.trainingLoad,
          };

          await prisma.activity.update({
            where: { id: matchingActivity.id },
            data: {
              source: DataSourceType.GARMIN, // Garmin przejmuje nadrzędność
              sourceId: act.sourceId,
              name: matchingActivity.name.includes("Garmin") ? matchingActivity.name : act.name,
              duration: act.duration,
              elapsedTime: act.elapsedTime ?? matchingActivity.elapsedTime,
              distance: act.distance ?? matchingActivity.distance,
              avgHr: act.avgHr ?? matchingActivity.avgHr,
              maxHr: act.maxHr ?? matchingActivity.maxHr,
              calories: act.calories ?? matchingActivity.calories,
              avgSpeed: act.avgSpeed ?? matchingActivity.avgSpeed,
              vdotEstimate: act.vo2max ?? matchingActivity.vdotEstimate,
              rawData: mergedRaw as object,
            },
          });
        } else {
          // Tworzymy nową aktywność z Garmina
          await prisma.activity.upsert({
            where: {
              userId_sourceId_source: {
                userId: body.userId,
                sourceId: act.sourceId,
                source: DataSourceType.GARMIN,
              },
            },
            create: {
              userId: body.userId,
              source: DataSourceType.GARMIN,
              sourceId: act.sourceId,
              name: act.name,
              type: act.type as any,
              startedAt: startedAtDate,
              duration: act.duration,
              elapsedTime: act.elapsedTime ?? null,
              distance: act.distance ?? null,
              avgHr: act.avgHr ?? null,
              maxHr: act.maxHr ?? null,
              calories: act.calories ?? null,
              avgSpeed: act.avgSpeed ?? null,
              vdotEstimate: act.vo2max ?? null,
              rawData: act as object,
            },
            update: {
              name: act.name,
              type: act.type as any,
              duration: act.duration,
              elapsedTime: act.elapsedTime ?? null,
              distance: act.distance ?? null,
              avgHr: act.avgHr ?? null,
              maxHr: act.maxHr ?? null,
              calories: act.calories ?? null,
              avgSpeed: act.avgSpeed ?? null,
              vdotEstimate: act.vo2max ?? null,
              rawData: act as object,
            },
          });
        }
        results.activities++;
      }
    }

    // 4. HeartRate samples (z czyszczeniem paczki czasowej w celu uniknięcia duplikatów)
    if (body.heartRateSamples?.length) {
      // Wyciągamy zakres czasowy próbek w paczce
      const dates = body.heartRateSamples.map(x => new Date(x.recordedAt).getTime());
      const minTime = new Date(Math.min(...dates));
      const maxTime = new Date(Math.max(...dates));

      // Usuwamy istniejące próbki w tym przedziale, aby zapobiec dublowaniu
      await prisma.heartRateSample.deleteMany({
        where: {
          userId: body.userId,
          recordedAt: {
            gte: minTime,
            lte: maxTime,
          },
        },
      });

      // Zapisujemy próbki za pomocą createMany (obsługiwane w SQLite)
      const dataToCreate = body.heartRateSamples.map(s => ({
        userId: body.userId,
        recordedAt: new Date(s.recordedAt),
        bpm: s.bpm,
        type: s.type || null,
      }));

      await prisma.heartRateSample.createMany({
        data: dataToCreate,
      });

      results.heartRateSamples = dataToCreate.length;
    }

    // 5. Update DataSource lastSyncedAt
    const dataSource = await prisma.dataSource.upsert({
      where: { userId_type: { userId: body.userId, type: DataSourceType.GARMIN } },
      create: {
        userId: body.userId,
        type: DataSourceType.GARMIN,
        isActive: true,
        lastSyncedAt: new Date(),
      },
      update: {
        isActive: true,
        lastSyncedAt: new Date(),
      },
    });

    // 6. Sync log
    const totalItems = results.sleep + results.dailyMetrics + results.activities + results.heartRateSamples;
    await prisma.syncLog.create({
      data: {
        userId: body.userId,
        dataSourceId: dataSource.id,
        triggeredBy: "garmin-script",
        status: "success",
        itemsSynced: totalItems,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    return Response.json({
      ok: true,
      ingested: results,
      total: totalItems,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const errorStack = err instanceof Error ? err.stack : "";
    console.error("Garmin ingest error detail:", errorMsg, errorStack);
    return Response.json({ error: errorMsg, stack: errorStack }, { status: 500 });
  }
}

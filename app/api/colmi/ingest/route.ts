import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/colmi/ingest
 *
 * Accepts data from the Colmi ring sync script.
 * Protected by COLMI_INGEST_SECRET bearer token (not user session — script runs headless).
 *
 * Body: {
 *   userId: string,
 *   sleep?: { date, bedAt?, wakeAt?, totalMinutes?, deepMinutes?, remMinutes?, lightMinutes?, awakeMinutes?, efficiency? }[],
 *   heartRate?: { recordedAt, bpm, type? }[],
 *   dailyMetrics?: { date, steps?, restingHr?, hrv?, spo2?, stressScore?, activeCalories?, totalCalories? }[],
 *   temperature?: { recordedAt, tempCelsius }[],
 * }
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

interface HeartRateInput {
  recordedAt: string;
  bpm: number;
  type?: string | null;
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
}

interface TemperatureInput {
  recordedAt: string;
  tempCelsius: number;
}

interface IngestPayload {
  userId: string;
  sleep?: SleepInput[];
  heartRate?: HeartRateInput[];
  dailyMetrics?: DailyMetricInput[];
  temperature?: TemperatureInput[];
}

export async function POST(request: Request) {
  // Auth: bearer token
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.COLMI_INGEST_SECRET;

  if (!expectedToken) {
    return Response.json({ error: "COLMI_INGEST_SECRET not configured" }, { status: 500 });
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
    heartRate: 0,
    dailyMetrics: 0,
    temperature: 0,
  };

  // ─── Sleep sessions ─────────────────────────────────────────────────────────
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

  // ─── Heart rate samples ─────────────────────────────────────────────────────
  if (body.heartRate?.length) {
    // Batch insert — skip duplicates by checking existing timestamps
    const hrData = body.heartRate.map((hr) => ({
      userId: body.userId,
      recordedAt: new Date(hr.recordedAt),
      bpm: hr.bpm,
      type: hr.type ?? "periodic",
    }));

    // Use createMany with skipDuplicates (Prisma doesn't support this for pg adapter directly,
    // so we'll do individual creates with a try/catch for now — or batch with raw)
    for (const hr of hrData) {
      // Check if we already have a sample within 1 minute of this timestamp
      const existing = await prisma.heartRateSample.findFirst({
        where: {
          userId: body.userId,
          recordedAt: {
            gte: new Date(hr.recordedAt.getTime() - 30000), // ±30s
            lte: new Date(hr.recordedAt.getTime() + 30000),
          },
          bpm: hr.bpm,
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.heartRateSample.create({ data: hr });
        results.heartRate++;
      }
    }
  }

  // ─── Daily metrics ──────────────────────────────────────────────────────────
  if (body.dailyMetrics?.length) {
    for (const m of body.dailyMetrics) {
      const dateObj = new Date(m.date);
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
          rawData: m as object,
        },
        update: {
          // Only update fields that are provided (don't null out existing data)
          ...(m.steps != null && { steps: m.steps }),
          ...(m.restingHr != null && { restingHr: m.restingHr }),
          ...(m.hrv != null && { hrv: m.hrv }),
          ...(m.spo2 != null && { spo2: m.spo2 }),
          ...(m.stressScore != null && { stressScore: m.stressScore }),
          ...(m.activeCalories != null && { activeCalories: m.activeCalories }),
          ...(m.totalCalories != null && { totalCalories: m.totalCalories }),
          rawData: m as object,
        },
      });
      results.dailyMetrics++;
    }
  }

  // ─── Temperature (stored as HR samples with type "temperature") ─────────────
  // Note: We store temperature in HeartRateSample with type="temperature" and bpm=temp*10
  // This is a pragmatic choice — avoids schema change. Alternative: add a Temperature model later.
  if (body.temperature?.length) {
    for (const t of body.temperature) {
      const recordedAt = new Date(t.recordedAt);
      const existing = await prisma.heartRateSample.findFirst({
        where: {
          userId: body.userId,
          recordedAt: {
            gte: new Date(recordedAt.getTime() - 30000),
            lte: new Date(recordedAt.getTime() + 30000),
          },
          type: "temperature",
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.heartRateSample.create({
          data: {
            userId: body.userId,
            recordedAt,
            bpm: Math.round(t.tempCelsius * 10), // store as 365 = 36.5°C
            type: "temperature",
          },
        });
        results.temperature++;
      }
    }
  }

  // ─── Update DataSource lastSyncedAt ─────────────────────────────────────────
  await prisma.dataSource.upsert({
    where: { userId_type: { userId: body.userId, type: DataSourceType.COLMI } },
    create: {
      userId: body.userId,
      type: DataSourceType.COLMI,
      isActive: true,
      lastSyncedAt: new Date(),
    },
    update: {
      isActive: true,
      lastSyncedAt: new Date(),
    },
  });

  // ─── Sync log ───────────────────────────────────────────────────────────────
  const totalItems = results.sleep + results.heartRate + results.dailyMetrics + results.temperature;
  await prisma.syncLog.create({
    data: {
      userId: body.userId,
      triggeredBy: "colmi-script",
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
}

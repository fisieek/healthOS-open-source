import { prisma } from "@/lib/db";
import { ActivityType, DataSourceType, Prisma } from "@/app/generated/prisma";
import { recomputeActivityAnalytics } from "@/lib/services/intensity";

const STRAVA_BASE = "https://www.strava.com/api/v3";
const STRAVA_AUTH = "https://www.strava.com/oauth";

// Streams we always pull when available — covers HR zones, pace zones, power, terrain.
const STREAM_KEYS = [
  "time",
  "heartrate",
  "distance",
  "velocity_smooth",
  "altitude",
  "cadence",
  "watts",
  "temp",
  "latlng",
  "grade_smooth",
  "moving",
];

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export function getStravaAuthUrl(redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  return `${STRAVA_AUTH}/authorize?${params}`;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number };
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string,
): Promise<StravaTokenResponse> {
  const res = await fetch(`${STRAVA_AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strava token exchange failed: ${body}`);
  }
  return res.json();
}

async function getStravaCredentials(userId: string): Promise<{ clientId: string; clientSecret: string }> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });
  const s = (profile?.settings ?? {}) as Record<string, unknown>;
  const clientId = (s.stravaClientId as string) ?? process.env.STRAVA_CLIENT_ID ?? "";
  const clientSecret = (s.stravaClientSecret as string) ?? process.env.STRAVA_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) throw new Error("Brak credentials Strava — skonfiguruj Client ID i Secret w ustawieniach.");
  return { clientId, clientSecret };
}

async function refreshAccessToken(userId: string): Promise<string> {
  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.STRAVA } },
  });
  if (!source) throw new Error("Strava not connected");

  const now = new Date();
  if (source.tokenExpiresAt && source.tokenExpiresAt > now) {
    return source.accessToken!;
  }

  const { clientId, clientSecret } = await getStravaCredentials(userId);

  const res = await fetch(`${STRAVA_AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: source.refreshToken!,
    }),
  });
  if (!res.ok) throw new Error("Strava token refresh failed");
  const data: StravaTokenResponse = await res.json();

  await prisma.dataSource.update({
    where: { userId_type: { userId, type: DataSourceType.STRAVA } },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(data.expires_at * 1000),
    },
  });

  return data.access_token;
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

function mapStravaType(type: string): ActivityType {
  const t = type.toLowerCase();
  if (t === "run" || t === "virtualrun" || t === "trailrun") return ActivityType.RUN;
  if (t === "ride" || t === "virtualride" || t === "ebikeride" || t === "gravelride" || t === "mountainbikeride")
    return ActivityType.RIDE;
  if (t === "swim") return ActivityType.SWIM;
  if (t === "weighttraining" || t === "crossfit" || t === "workout")
    return ActivityType.STRENGTH;
  return ActivityType.OTHER;
}

// ─── Strava Activity types (subset we actually use) ───────────────────────────

interface StravaSummaryActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  moving_time: number;
  elapsed_time?: number;
  distance: number;
  total_elevation_gain: number;
  elev_high?: number;
  elev_low?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  max_speed?: number;
  average_cadence?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  max_watts?: number;
  kilojoules?: number;
  average_temp?: number;
  suffer_score?: number;
  calories?: number;
  description?: string;
  gear_id?: string;
  device_name?: string;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  map?: { polyline?: string; summary_polyline?: string };
  kudos_count?: number;
  comment_count?: number;
  pr_count?: number;
  achievement_count?: number;
}

interface StravaDetailedActivity extends StravaSummaryActivity {
  splits_metric?: unknown[];
  splits_standard?: unknown[];
  laps?: unknown[];
  best_efforts?: unknown[];
  segment_efforts?: unknown[];
  photos?: unknown;
}

type StravaStreamsKeyed = Record<
  string,
  { data: number[] | [number, number][]; series_type: string; original_size: number; resolution: string } | undefined
>;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function stravaFetch<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${STRAVA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null; // resource gone
  if (res.status === 429) {
    // rate-limited → caller should retry later; we just bail quietly
    throw new Error("Strava rate limit reached");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Strava ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function fetchDetailedActivity(
  token: string,
  id: number
): Promise<StravaDetailedActivity | null> {
  return stravaFetch<StravaDetailedActivity>(
    token,
    `/activities/${id}?include_all_efforts=true`
  );
}

async function fetchActivityStreams(
  token: string,
  id: number
): Promise<StravaStreamsKeyed | null> {
  const keys = STREAM_KEYS.join(",");
  return stravaFetch<StravaStreamsKeyed>(
    token,
    `/activities/${id}/streams?keys=${keys}&key_by_type=true`
  );
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

interface UpsertOptions {
  fetchDetails: boolean;
  fetchStreams: boolean;
}

async function upsertActivity(
  userId: string,
  token: string,
  summary: StravaSummaryActivity,
  opts: UpsertOptions
): Promise<void> {
  let detailed: StravaDetailedActivity | null = null;
  let streams: StravaStreamsKeyed | null = null;

  if (opts.fetchDetails) {
    try {
      detailed = await fetchDetailedActivity(token, summary.id);
    } catch (err) {
      // log & continue — we still have summary data
      console.warn(`[strava] failed to fetch details for ${summary.id}:`, err);
    }
  }

  if (opts.fetchStreams) {
    try {
      streams = await fetchActivityStreams(token, summary.id);
    } catch (err) {
      console.warn(`[strava] failed to fetch streams for ${summary.id}:`, err);
    }
  }

  const a = detailed ?? summary;
  const startedAt = new Date(a.start_date);
  const distance = a.distance ?? null;
  const movingTime = a.moving_time;

  // Build update payload first (allows partial updates without overwriting cached rawData/streams with null)
  const baseData = {
    name: a.name,
    type: mapStravaType(a.sport_type ?? a.type),
    startedAt,
    duration: movingTime,
    elapsedTime: a.elapsed_time ?? null,
    distance,
    elevGain: a.total_elevation_gain ?? null,
    elevLow: a.elev_low ?? null,
    elevHigh: a.elev_high ?? null,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    avgPace: distance && movingTime ? movingTime / (distance / 1000) : null,
    avgSpeed: a.average_speed ?? null,
    maxSpeed: a.max_speed ?? null,
    avgCadence: a.average_cadence ?? null,
    avgWatts: a.average_watts ?? null,
    weightedAvgWatts: a.weighted_average_watts ?? null,
    maxWatts: a.max_watts ?? null,
    kilojoules: a.kilojoules ?? null,
    avgTemp: a.average_temp ?? null,
    sufferScore: a.suffer_score ?? null,
    calories: a.calories ?? null,
    description: a.description ?? null,
    externalUrl: `https://www.strava.com/activities/${a.id}`,
    gearId: a.gear_id ?? null,
    deviceName: a.device_name ?? null,
    startLat: a.start_latlng?.[0] ?? null,
    startLng: a.start_latlng?.[1] ?? null,
    endLat: a.end_latlng?.[0] ?? null,
    endLng: a.end_latlng?.[1] ?? null,
    mapPolyline: a.map?.polyline ?? null,
    mapSummaryPolyline: a.map?.summary_polyline ?? null,
    kudosCount: a.kudos_count ?? null,
    commentCount: a.comment_count ?? null,
    prCount: a.pr_count ?? null,
    achievementCount: a.achievement_count ?? null,
  };

  // JSON fields: only set when we actually fetched them; keep DB value otherwise.
  const jsonFields: {
    rawData?: Prisma.InputJsonValue;
    streams?: Prisma.InputJsonValue;
  } = {};
  if (detailed) jsonFields.rawData = detailed as unknown as Prisma.InputJsonValue;
  else if (!opts.fetchDetails === false && summary) {
    // first-time insert without details: store summary as fallback rawData
    // (but only on create — handled below)
  }
  if (streams) jsonFields.streams = streams as unknown as Prisma.InputJsonValue;

  // For first-time create, fall back to summary as rawData if no details fetched.
  const createJsonFields: {
    rawData?: Prisma.InputJsonValue;
    streams?: Prisma.InputJsonValue;
  } = { ...jsonFields };
  if (!createJsonFields.rawData) {
    createJsonFields.rawData = a as unknown as Prisma.InputJsonValue;
  }

  await prisma.activity.upsert({
    where: {
      userId_sourceId_source: {
        userId,
        sourceId: String(a.id),
        source: DataSourceType.STRAVA,
      },
    },
    create: {
      userId,
      sourceId: String(a.id),
      source: DataSourceType.STRAVA,
      ...baseData,
      ...createJsonFields,
    },
    update: {
      ...baseData,
      ...jsonFields,
    },
  });

  // Post-upsert: recompute zone minutes / intensity class / VDOT.
  // Cheap if no streams/profile; otherwise gives us full analytics on the fly.
  const upserted = await prisma.activity.findUnique({
    where: {
      userId_sourceId_source: {
        userId,
        sourceId: String(a.id),
        source: DataSourceType.STRAVA,
      },
    },
    select: { id: true },
  });
  if (upserted) {
    try {
      await recomputeActivityAnalytics(upserted.id);
    } catch (err) {
      console.warn(`[strava] recomputeActivityAnalytics failed for ${a.id}:`, err);
    }
  }
}

// ─── Sync (incremental) ───────────────────────────────────────────────────────

export interface StravaSyncOptions {
  /** Force-refresh: re-fetch details/streams even for already-synced activities. */
  fullRefresh?: boolean;
  /** Override the "since" timestamp (epoch seconds). Default: lastSyncedAt. */
  afterEpoch?: number;
  /** When true, fetch detailed activity + streams for each item. Default: true. */
  withDetails?: boolean;
}

export async function syncStravaActivities(
  userId: string,
  options: StravaSyncOptions = {}
): Promise<number> {
  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.STRAVA } },
  });
  if (!source) throw new Error("Strava not connected");

  const token = await refreshAccessToken(userId);
  const after =
    options.afterEpoch ??
    (source.lastSyncedAt ? Math.floor(source.lastSyncedAt.getTime() / 1000) : 0);
  const withDetails = options.withDetails ?? true;

  let page = 1;
  let total = 0;

  while (true) {
    const params = new URLSearchParams({
      per_page: "100",
      page: String(page),
      ...(after > 0 ? { after: String(after) } : {}),
    });

    const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`);

    const activities: StravaSummaryActivity[] = await res.json();
    if (activities.length === 0) break;

    for (const a of activities) {
      let fetchDetails = withDetails;
      let fetchStreams = withDetails;

      if (!options.fullRefresh) {
        // Skip detail/stream re-fetch if we already have them (cheap upsert of summary only)
        const existing = await prisma.activity.findUnique({
          where: {
            userId_sourceId_source: {
              userId,
              sourceId: String(a.id),
              source: DataSourceType.STRAVA,
            },
          },
          select: { rawData: true, streams: true },
        });
        if (existing) {
          if (existing.rawData) fetchDetails = false;
          if (existing.streams) fetchStreams = false;
        }
      }

      await upsertActivity(userId, token, a, { fetchDetails, fetchStreams });
      total++;
    }

    if (activities.length < 100) break;
    page++;
  }

  await prisma.dataSource.update({
    where: { userId_type: { userId, type: DataSourceType.STRAVA } },
    data: { lastSyncedAt: new Date() },
  });

  return total;
}

// ─── Backfill (historical: fetch missing details/streams for already-synced activities) ──

export interface BackfillOptions {
  /** Only process activities older than this date (default: no limit). */
  olderThan?: Date;
  /** Max items to backfill per call (Strava rate limits). Default: 50. */
  limit?: number;
  /** When true, also re-fetch already-cached details. Default: false (only fill nulls). */
  force?: boolean;
}

export async function backfillStravaDetails(
  userId: string,
  options: BackfillOptions = {}
): Promise<{ processed: number; skipped: number; errors: number }> {
  const limit = options.limit ?? 50;
  const token = await refreshAccessToken(userId);

  const targets = await prisma.activity.findMany({
    where: {
      userId,
      source: DataSourceType.STRAVA,
      ...(options.olderThan ? { startedAt: { lt: options.olderThan } } : {}),
      ...(options.force
        ? {}
        : {
            OR: [
              { rawData: { equals: Prisma.DbNull } },
              { streams: { equals: Prisma.DbNull } },
            ],
          }),
    },
    select: { id: true, sourceId: true, rawData: true, streams: true },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of targets) {
    if (!t.sourceId) {
      skipped++;
      continue;
    }
    const id = Number(t.sourceId);
    const needsDetails = options.force || !t.rawData;
    const needsStreams = options.force || !t.streams;

    try {
      const detailed = needsDetails ? await fetchDetailedActivity(token, id) : null;
      const streams = needsStreams ? await fetchActivityStreams(token, id) : null;

      const updateData: {
        rawData?: Prisma.InputJsonValue;
        streams?: Prisma.InputJsonValue;
      } = {};
      if (detailed) updateData.rawData = detailed as unknown as Prisma.InputJsonValue;
      if (streams) updateData.streams = streams as unknown as Prisma.InputJsonValue;

      if (Object.keys(updateData).length > 0) {
        await prisma.activity.update({ where: { id: t.id }, data: updateData });
        // Streams just arrived → recompute zones/intensity/VDOT.
        try {
          await recomputeActivityAnalytics(t.id);
        } catch (err) {
          console.warn(`[strava] recompute failed for ${t.id} after backfill:`, err);
        }
      }
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      if (msg.includes("rate limit")) {
        // Stop early on rate limit so we resume next time
        break;
      }
      console.warn(`[strava] backfill failed for activity ${t.sourceId}:`, err);
      errors++;
    }
  }

  return { processed, skipped, errors };
}

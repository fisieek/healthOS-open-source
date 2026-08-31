import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Activity as ActivityIcon,
  ArrowLeft,
  Clock,
  Map as MapIcon,
  Mountain,
  Heart,
  Flame,
  Gauge,
  Thermometer,
  Trophy,
  ExternalLink,
  Cpu,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ActivityType } from "@/app/generated/prisma/client";
import { computeZones, type ZoneDef } from "@/lib/services/zones";
import { decodePolyline, projectToSvg } from "@/lib/services/polyline";
import { ActivityCharts } from "./activity-charts";
import { ActivityEditPanel } from "./activity-edit-panel";

const activityLabel: Record<ActivityType, string> = {
  RUN: "Bieg",
  RIDE: "Rower",
  SWIM: "Pływanie",
  STRENGTH: "Siła",
  OTHER: "Inne",
};

function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDistance(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function fmtPace(spk: number | null | undefined): string {
  if (!spk || !Number.isFinite(spk)) return "—";
  const m = Math.floor(spk / 60);
  const s = Math.floor(spk % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function fmtSpeedFromMps(mps: number | null | undefined): string {
  if (mps == null) return "—";
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

const ZONE_BG: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-blue-400",
  2: "bg-green-400",
  3: "bg-yellow-400",
  4: "bg-orange-500",
  5: "bg-red-500",
};

interface StreamData {
  data?: number[] | [number, number][];
}

interface StreamsKeyed {
  [key: string]: StreamData | undefined;
}

interface ChartPoint {
  t: number;
  hr?: number | null;
  pace?: number | null;
  speed?: number | null;
  alt?: number | null;
  cadence?: number | null;
  watts?: number | null;
  temp?: number | null;
}

interface SplitMetric {
  distance: number;
  elapsed_time: number;
  moving_time?: number;
  average_speed?: number;
  average_heartrate?: number;
  elevation_difference?: number;
  pace_zone?: number;
  split: number;
}

interface RawData {
  splits_metric?: SplitMetric[];
  laps?: { name?: string; distance?: number; moving_time?: number; average_heartrate?: number; average_speed?: number; total_elevation_gain?: number }[];
  best_efforts?: { name?: string; distance?: number; moving_time?: number; pr_rank?: number }[];
}

/**
 * Convert raw streams to chart-friendly points, downsampling if too dense.
 * Strava streams come at 1Hz typically; for a 2h ride that's 7200 points.
 * We keep at most ~600 points for fast rendering.
 */
function buildChartPoints(streams: StreamsKeyed | null | undefined): ChartPoint[] {
  if (!streams) return [];

  const time = streams.time?.data as number[] | undefined;
  const hr = streams.heartrate?.data as number[] | undefined;
  const dist = streams.distance?.data as number[] | undefined;
  const speed = streams.velocity_smooth?.data as number[] | undefined;
  const alt = streams.altitude?.data as number[] | undefined;
  const cad = streams.cadence?.data as number[] | undefined;
  const watts = streams.watts?.data as number[] | undefined;
  const temp = streams.temp?.data as number[] | undefined;

  const refLen =
    time?.length ??
    hr?.length ??
    dist?.length ??
    speed?.length ??
    alt?.length ??
    0;
  if (refLen === 0) return [];

  const stride = Math.max(1, Math.floor(refLen / 600));
  const out: ChartPoint[] = [];

  for (let i = 0; i < refLen; i += stride) {
    const t = time ? time[i] : i;
    const sp = speed?.[i];
    out.push({
      t,
      hr: hr?.[i] ?? null,
      pace: sp != null && sp > 0.3 ? 1000 / sp : null, // s/km from m/s
      speed: sp ?? null,
      alt: alt?.[i] ?? null,
      cadence: cad?.[i] ?? null,
      watts: watts?.[i] ?? null,
      temp: temp?.[i] ?? null,
    });
  }
  return out;
}

interface RouteSvgProps {
  polyline: string | null;
  width?: number;
  height?: number;
}

function RouteMap({ polyline, width = 720, height = 220 }: RouteSvgProps) {
  if (!polyline) return null;
  const coords = decodePolyline(polyline);
  if (coords.length < 2) return null;
  const { points, viewBox } = projectToSvg(coords, width, height, 16);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
          <MapIcon className="h-3.5 w-3.5" />
          Trasa
        </h3>
        <span className="text-[10px] text-muted-foreground">{coords.length} pkt</span>
      </div>
      <svg
        viewBox={viewBox}
        className="w-full"
        style={{ aspectRatio: `${width}/${height}` }}
      >
        {/* Background grid */}
        <rect x={0} y={0} width={width} height={height} fill="hsl(var(--muted) / 0.15)" />
        {/* Route */}
        <path
          d={d}
          fill="none"
          stroke="#fb923c"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Start/end markers */}
        {points[0] && (
          <circle
            cx={points[0].x}
            cy={points[0].y}
            r={4}
            fill="#22c55e"
            stroke="white"
            strokeWidth={1.5}
          />
        )}
        {points[points.length - 1] && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={4}
            fill="#ef4444"
            stroke="white"
            strokeWidth={1.5}
          />
        )}
      </svg>
    </div>
  );
}

interface ZonesBarProps {
  zoneMinutes: { z1: number; z2: number; z3: number; z4: number; z5: number; total: number };
  zones: ZoneDef[] | null;
}

function ZonesBar({ zoneMinutes, zones }: ZonesBarProps) {
  const total = zoneMinutes.total || 1;
  const data: { id: 1 | 2 | 3 | 4 | 5; min: number; pct: number; bounds?: [number, number] }[] = [
    { id: 1, min: zoneMinutes.z1, pct: (zoneMinutes.z1 / total) * 100 },
    { id: 2, min: zoneMinutes.z2, pct: (zoneMinutes.z2 / total) * 100 },
    { id: 3, min: zoneMinutes.z3, pct: (zoneMinutes.z3 / total) * 100 },
    { id: 4, min: zoneMinutes.z4, pct: (zoneMinutes.z4 / total) * 100 },
    { id: 5, min: zoneMinutes.z5, pct: (zoneMinutes.z5 / total) * 100 },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide mb-3">
        Czas w strefach
      </h3>
      {/* Stacked bar */}
      <div className="flex h-3 w-full rounded overflow-hidden bg-muted/40 mb-3">
        {data.map((d) =>
          d.pct > 0 ? (
            <div
              key={d.id}
              className={ZONE_BG[d.id]}
              style={{ width: `${d.pct}%` }}
              title={`Z${d.id}: ${d.min} min`}
            />
          ) : null
        )}
      </div>
      {/* Per-zone breakdown */}
      <div className="grid grid-cols-5 gap-1.5">
        {data.map((d) => {
          const z = zones?.find((zz) => zz.id === d.id);
          return (
            <div
              key={d.id}
              className="flex flex-col items-center gap-0.5 rounded-md border border-border p-1.5 min-w-0"
            >
              <span className={`h-1 w-full rounded-sm ${ZONE_BG[d.id]}`} />
              <span className="text-[10px] font-medium">Z{d.id}</span>
              <span className="text-xs font-bold">{d.min}m</span>
              <span className="text-[9px] text-muted-foreground">{d.pct.toFixed(0)}%</span>
              {z && (
                <span className="text-[9px] text-muted-foreground/80 font-mono">
                  {z.low}-{z.high}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      sessionStatuses: {
        include: {
          planSession: { select: { id: true, name: true, type: true, date: true } },
        },
      },
    },
  });

  if (!activity || activity.userId !== session.user.id) notFound();

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });
  const zones = profile
    ? computeZones({
        method: profile.zonesMethod,
        maxHr: profile.maxHr,
        restingHr: profile.restingHr,
        lthr: profile.lthr,
      })
    : null;

  const isCycling = activity.type === ActivityType.RIDE;
  const points = buildChartPoints(activity.streams as StreamsKeyed | null);
  const zoneMinutes = activity.zoneMinutes as
    | { z1: number; z2: number; z3: number; z4: number; z5: number; total: number }
    | null;
  const raw = (activity.rawData ?? null) as RawData | null;

  const startedAt = activity.startedAt;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/calendar"
            className="text-muted-foreground hover:text-foreground transition-colors mt-1"
            aria-label="Wróć do kalendarza"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {activityLabel[activity.type]}
              </Badge>
              {activity.intensityClass && (
                <Badge variant="outline" className="text-[10px]">
                  {activity.intensityClass}
                  {activity.intensityClassOverride && " 🔒"}
                </Badge>
              )}
              {activity.prCount && activity.prCount > 0 ? (
                <Badge className="text-[10px] bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                  <Trophy className="h-3 w-3 mr-1" />
                  {activity.prCount} PR
                </Badge>
              ) : null}
              {activity.achievementCount && activity.achievementCount > 0 ? (
                <Badge variant="outline" className="text-[10px]">
                  <Award className="h-3 w-3 mr-1" />
                  {activity.achievementCount}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold mt-1 truncate">{activity.name}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(startedAt, "EEEE, d MMMM yyyy 'o' HH:mm", { locale: pl })}
            </p>
          </div>
        </div>
        {activity.externalUrl && (
          <a
            href={activity.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-1"
          >
            Strava <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Plan link (if matched) */}
      {activity.sessionStatuses[0]?.planSession && (
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            📋 Plan: {activity.sessionStatuses[0].planSession.name}
          </Badge>
          <span className="text-muted-foreground">Status:</span>
          <span className="font-medium">{activity.sessionStatuses[0].status}</span>
          {activity.sessionStatuses[0].matchScore != null && (
            <span className="text-muted-foreground">
              · score {activity.sessionStatuses[0].matchScore.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <KpiCard icon={Clock} label="Czas" value={fmtDuration(activity.duration)} hint={activity.elapsedTime ? `elapsed ${fmtDuration(activity.elapsedTime)}` : undefined} />
        <KpiCard icon={ActivityIcon} label="Dystans" value={fmtDistance(activity.distance)} />
        {isCycling ? (
          <KpiCard icon={Gauge} label="Średnia prędkość" value={fmtSpeedFromMps(activity.avgSpeed)} hint={activity.maxSpeed ? `max ${fmtSpeedFromMps(activity.maxSpeed)}` : undefined} />
        ) : (
          <KpiCard icon={Gauge} label="Średnie tempo" value={fmtPace(activity.avgPace)} />
        )}
        <KpiCard icon={Heart} label="Tętno śr." value={activity.avgHr ? `${activity.avgHr} bpm` : "—"} hint={activity.maxHr ? `max ${activity.maxHr}` : undefined} />
        <KpiCard icon={Mountain} label="Przewyższenie" value={activity.elevGain ? `${Math.round(activity.elevGain)} m` : "—"} hint={activity.elevHigh ? `max ${Math.round(activity.elevHigh)} m` : undefined} />
        <KpiCard icon={Flame} label="Kalorie" value={activity.calories ? `${activity.calories} kcal` : "—"} hint={activity.kilojoules ? `${Math.round(activity.kilojoules)} kJ` : undefined} />

        {/* Optional row 2 */}
        {activity.avgWatts != null && (
          <KpiCard icon={Cpu} label="Moc śr." value={`${Math.round(activity.avgWatts)} W`} hint={activity.weightedAvgWatts ? `NP ${activity.weightedAvgWatts}` : undefined} />
        )}
        {activity.avgCadence != null && (
          <KpiCard icon={Gauge} label="Kadencja" value={`${Math.round(activity.avgCadence)} ${isCycling ? "rpm" : "spm"}`} />
        )}
        {activity.avgTemp != null && (
          <KpiCard icon={Thermometer} label="Temp." value={`${activity.avgTemp.toFixed(1)} °C`} />
        )}
        {activity.sufferScore != null && (
          <KpiCard icon={Flame} label="Suffer" value={`${activity.sufferScore}`} hint="Strava Relative Effort" />
        )}
        {activity.vdotEstimate != null && (
          <KpiCard icon={ActivityIcon} label="VDOT" value={activity.vdotEstimate.toFixed(1)} hint="Daniels (z tego biegu)" />
        )}
      </div>

      {/* Two-column: charts + edit panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <RouteMap polyline={activity.mapPolyline ?? activity.mapSummaryPolyline} />

          {/* Zones bar */}
          {zoneMinutes && zoneMinutes.total > 0 && (
            <ZonesBar zoneMinutes={zoneMinutes} zones={zones} />
          )}

          {/* Charts */}
          <ActivityCharts points={points} zones={zones} isCycling={isCycling} />

          {/* Splits */}
          {raw?.splits_metric && raw.splits_metric.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                  Splity (1 km)
                </h3>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {raw.splits_metric.map((s, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 px-3 py-1.5 text-xs">
                    <span className="font-medium">{s.split}</span>
                    <span className="text-muted-foreground">{fmtDistance(s.distance)}</span>
                    <span>{fmtDuration(s.moving_time ?? s.elapsed_time)}</span>
                    <span className="font-mono">
                      {s.average_speed && s.average_speed > 0 ? fmtPace(1000 / s.average_speed) : "—"}
                    </span>
                    <span className="text-right">
                      {s.average_heartrate ? `${Math.round(s.average_heartrate)}` : "—"}
                      {s.elevation_difference != null && s.elevation_difference !== 0 ? (
                        <span className="text-muted-foreground ml-1">
                          {s.elevation_difference > 0 ? "↑" : "↓"}
                          {Math.abs(Math.round(s.elevation_difference))}m
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Laps */}
          {raw?.laps && raw.laps.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                  Okrążenia ({raw.laps.length})
                </h3>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {raw.laps.map((l, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 px-3 py-1.5 text-xs">
                    <span className="font-medium truncate">{l.name ?? `Lap ${i + 1}`}</span>
                    <span className="text-muted-foreground">{fmtDistance(l.distance ?? null)}</span>
                    <span>{fmtDuration(l.moving_time ?? null)}</span>
                    <span className="font-mono">
                      {l.average_speed && l.average_speed > 0 ? fmtPace(1000 / l.average_speed) : "—"}
                    </span>
                    <span className="text-right">{l.average_heartrate ? `${Math.round(l.average_heartrate)} bpm` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best efforts (running) */}
          {raw?.best_efforts && raw.best_efforts.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
                  Best efforts
                </h3>
              </div>
              <div className="divide-y divide-border">
                {raw.best_efforts.map((be, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs">
                    <span className="font-medium">{be.name}</span>
                    <span className="text-muted-foreground">{fmtDistance(be.distance ?? null)}</span>
                    <span>
                      {fmtDuration(be.moving_time ?? null)}
                      {be.pr_rank ? <span className="ml-2 text-yellow-600">🏆 #{be.pr_rank}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {activity.description && (
            <div className="rounded-lg border border-border bg-card p-3">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide mb-1.5">
                Opis
              </h3>
              <p className="text-sm whitespace-pre-wrap">{activity.description}</p>
            </div>
          )}
        </div>

        {/* Right column: edit panel + meta */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <ActivityEditPanel
              activityId={activity.id}
              initialMood={activity.moodScore}
              initialMoodNote={activity.moodNote}
              initialIntensity={activity.intensityClass}
              initialOverride={activity.intensityClassOverride}
              type={activity.type}
            />
          </div>

          {/* Meta info */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Źródło</span>
              <span>{activity.source}</span>
            </div>
            {activity.deviceName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Urządzenie</span>
                <span className="truncate ml-2">{activity.deviceName}</span>
              </div>
            )}
            {activity.gearId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gear ID</span>
                <span className="font-mono text-[10px]">{activity.gearId}</span>
              </div>
            )}
            {activity.kudosCount != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kudos</span>
                <span>{activity.kudosCount}</span>
              </div>
            )}
            {activity.startLat != null && activity.startLng != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start</span>
                <span className="font-mono text-[10px]">
                  {activity.startLat.toFixed(4)}, {activity.startLng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

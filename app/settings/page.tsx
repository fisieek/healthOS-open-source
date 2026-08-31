import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";
import { StravaConnectButton } from "./strava-connect-button";
import { SyncButton } from "./sync-button";
import { HevyApiKeyForm, HevySyncButton } from "./hevy-form";
import { GarminCredentialsForm, GarminSyncButton } from "./garmin-form";
import { AutoSyncToggle } from "./auto-sync-toggle";
import { ProfileForm } from "./profile-form";
import { StravaBackfillButton } from "./strava-backfill-button";
import { SettingsClient } from "./settings-client";
import { NotificationsForm } from "./notifications-form";
import { parseNotificationPrefs } from "@/lib/constants/notifications";
import { GoogleCalendarForm } from "./google-calendar-form";
import { CheckCircle, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

export const runtime = "nodejs";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [strava, hevy, colmi, garmin, googleCalendar, syncLogs, profile, subtypes] = await Promise.all([
    prisma.dataSource.findUnique({
      where: { userId_type: { userId, type: DataSourceType.STRAVA } },
      select: { isActive: true, lastSyncedAt: true, id: true, settings: true },
    }),
    prisma.dataSource.findUnique({
      where: { userId_type: { userId, type: DataSourceType.HEVY } },
      select: { isActive: true, accessToken: true, lastSyncedAt: true, id: true },
    }),
    prisma.dataSource.findUnique({
      where: { userId_type: { userId, type: DataSourceType.COLMI } },
      select: { isActive: true, lastSyncedAt: true },
    }),
    prisma.dataSource.findUnique({
      where: { userId_type: { userId, type: DataSourceType.GARMIN } },
      select: { isActive: true, lastSyncedAt: true, settings: true },
    }),
    prisma.dataSource.findUnique({
      where: { userId_type: { userId, type: DataSourceType.GOOGLE_CALENDAR } },
      select: { accessToken: true, lastSyncedAt: true },
    }),
    prisma.syncLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { dataSource: { select: { type: true } } },
    }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.activitySubtype.findMany({
      where: { userId },
      orderBy: [{ parentType: "asc" }, { order: "asc" }],
    }),
  ]);

  // Compute next CRON time (3:00 every day)
  const now = new Date();
  const nextCron = new Date(now);
  nextCron.setHours(3, 0, 0, 0);
  if (nextCron <= now) nextCron.setDate(nextCron.getDate() + 1);

  const nextCronStr = format(nextCron, "EEEE, d MMM yyyy 'o' HH:mm", { locale: pl });
  const nextCronDist = formatDistanceToNow(nextCron, { locale: pl });

  // Przygotowanie komponentów bocznych jako JSX
  const settingsJson = (profile?.settings ?? {}) as Record<string, unknown>;
  const weeklyRunningTargetKm = (settingsJson.weeklyRunningTargetKm as number) ?? 45;

  // Powiadomienia systemowe pokazuje proces główny Electrona, więc w wersji
  // webowej nie ma czego ustawiać — sekcja w ogóle nie powstaje.
  // Flagę ustawia `buildNextEnv()` w electron/main.ts.
  const isDesktop = process.env.HEALTHOS_DESKTOP === "1";
  const notificationsSection = isDesktop ? (
    <NotificationsForm
      initial={parseNotificationPrefs(settingsJson.desktopNotifications)}
    />
  ) : null;

  const googleCalendarSection = (
    <GoogleCalendarForm
      connected={!!googleCalendar?.accessToken}
      lastSyncedAt={googleCalendar?.lastSyncedAt?.toISOString() ?? null}
      hasCredentials={!!settingsJson.googleClientId && !!settingsJson.googleClientSecret}
      savedClientId={(settingsJson.googleClientId as string) ?? null}
      redirectUri={`${process.env.NEXTAUTH_URL}/api/integrations/google-calendar/callback`}
    />
  );

  const profileFormSection = (
    <ProfileForm
      initial={
        profile
          ? {
              birthDate: profile.birthDate?.toISOString() ?? null,
              sex: profile.sex,
              heightCm: profile.heightCm,
              maxHr: profile.maxHr,
              restingHr: profile.restingHr,
              lthr: profile.lthr,
              ftp: profile.ftp,
              thresholdPace: profile.thresholdPace,
              zonesMethod: profile.zonesMethod,
              weeklyRunningTargetKm: weeklyRunningTargetKm,
            }
          : null
      }
    />
  );

  const stravaSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">S</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Strava</p>
            <SourceStatus
              connected={!!strava}
              active={strava?.isActive}
              lastSyncedAt={strava?.lastSyncedAt}
            />
          </div>
        </div>
        <StravaConnectButton
          connected={!!strava?.isActive}
          initialClientId={(settingsJson.stravaClientId as string) ?? null}
        />
      </div>
      {strava && (
        <div className="space-y-2 pl-11 pt-2 border-t border-[#2e3229]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8c9282]">Auto-sync (codziennie o 3:00)</span>
            <AutoSyncToggle type="STRAVA" initial={strava.isActive} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#f1f2ec]">Backfill historii</p>
              <p className="text-[10px] text-[#8c9282]">
                Dofeczowuje pełne dane (streams HR, splity, mapy) dla starszych aktywności. Limit ~50 / 15 min.
              </p>
            </div>
            <StravaBackfillButton />
          </div>
        </div>
      )}
    </div>
  );

  const hevySection = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">H</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Hevy</p>
            <SourceStatus
              connected={!!hevy?.accessToken}
              active={hevy?.isActive}
              lastSyncedAt={hevy?.lastSyncedAt}
              connectedLabel="Klucz API skonfigurowany"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hevy?.accessToken && <HevySyncButton />}
          <HevyApiKeyForm hasKey={!!hevy?.accessToken} />
        </div>
      </div>
      {hevy?.accessToken && (
        <div className="flex items-center justify-between pl-11 pt-2 border-t border-[#2e3229]">
          <span className="text-xs text-[#8c9282]">Auto-sync (codziennie o 3:00)</span>
          <AutoSyncToggle type="HEVY" initial={hevy.isActive} />
        </div>
      )}
    </div>
  );

  const colmiSection = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">C</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Colmi Ring</p>
            <SourceStatus
              connected={!!colmi}
              active={colmi?.isActive}
              lastSyncedAt={colmi?.lastSyncedAt}
              connectedLabel="Skonfigurowano"
              notConnectedLabel="Brak danych z ringa"
            />
          </div>
        </div>
      </div>
      <div className="pl-11 pt-2 border-t border-[#2e3229] space-y-2">
        <p className="text-xs text-[#8c9282]">
          Colmi wymaga ręcznej synchronizacji z laptopa (BLE). Uruchom:
        </p>
        <CommandSnippet />
      </div>
    </div>
  );

  const garminSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center text-white text-xs font-bold shrink-0">G</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Garmin Connect</p>
            <SourceStatus
              connected={!!garmin}
              active={garmin?.isActive}
              lastSyncedAt={garmin?.lastSyncedAt}
              connectedLabel="Skonfigurowano"
              notConnectedLabel="Niepołączono"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {garmin && <GarminSyncButton />}
          <GarminCredentialsForm hasCredentials={!!garmin} />
        </div>
      </div>
      {garmin && (
        <div className="flex items-center justify-between pl-11 pt-2 border-t border-[#2e3229]">
          <span className="text-xs text-[#8c9282]">Auto-sync (codziennie o 3:00)</span>
          <AutoSyncToggle type="GARMIN" initial={garmin.isActive} />
        </div>
      )}
    </div>
  );

  const syncButtonSection = <SyncButton />;

  // Extract Runna data from profile settings
  const profileSettings = (profile?.settings ?? {}) as Record<string, unknown>;
  const runnaUrl = (profileSettings.runnaCalendarUrl as string) ?? null;
  const runnaLastSynced = (profileSettings.runnaLastSyncedAt as string) ?? null;

  return (
    <SettingsClient
      profileFormSection={profileFormSection}
      stravaSection={stravaSection}
      hevySection={hevySection}
      colmiSection={colmiSection}
      garminSection={garminSection}
      syncButtonSection={syncButtonSection}
      notificationsSection={notificationsSection}
      googleCalendarSection={googleCalendarSection}
      syncLogs={syncLogs}
      nextCronStr={nextCronStr}
      nextCronDist={nextCronDist}
      initialSubtypes={subtypes}
      userProfile={profile}
      initialRunnaUrl={runnaUrl}
      initialRunnaLastSynced={runnaLastSynced}
    />
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function SourceStatus({
  connected,
  active,
  lastSyncedAt,
  connectedLabel = "Połączono",
  notConnectedLabel = "Niepołączono",
}: {
  connected: boolean;
  active?: boolean;
  lastSyncedAt?: Date | null;
  connectedLabel?: string;
  notConnectedLabel?: string;
}) {
  if (!connected) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <XCircle className="h-3.5 w-3.5 text-[#8c9282]" />
        <span className="text-xs text-[#8c9282]">{notConnectedLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      {active ? (
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-yellow-500" />
      )}
      <span className="text-xs text-[#8c9282]">
        {connectedLabel}
        {lastSyncedAt && ` · ostatnia sync ${formatDistanceToNow(lastSyncedAt, { locale: pl, addSuffix: true })}`}
        {!active && connected && " (auto-sync wyłączony)"}
      </span>
    </div>
  );
}

function CommandSnippet() {
  const cmd = "cd ~/Desktop/healthOS/scripts && .venv/bin/python3.12 quick_sync.py && .venv/bin/python3.12 send_to_healthos.py";
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-[#0d0e0c] border border-[#2e3229] font-mono text-[11px] text-[#f1f2ec]/80">
      <code className="flex-1 truncate">{cmd}</code>
    </div>
  );
}

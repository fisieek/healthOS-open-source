import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ActivityType } from "@/app/generated/prisma/client";
import { computeZones } from "@/lib/services/zones";
import { startOfDay } from "date-fns";
import {
  getVo2maxTrend,
  getPaceRecords,
  getVolumeStats,
  getHrZonesSummary,
} from "@/lib/services/running-stats";

import Vo2maxCard from "@/components/bieg/vo2max-card";
import PaceRecords from "@/components/bieg/pace-records";
import VolumeRecords from "@/components/bieg/volume-records";
import HrZonesTable from "@/components/bieg/hr-zones-table";
import RunHistory from "@/components/bieg/run-history";
import PlannedRuns from "@/components/bieg/planned-runs";
import BiegUploadButton from "@/components/bieg/bieg-upload-button";

export default async function BiegPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const profile = await prisma.userProfile.findUnique({ where: { userId } });

  const [vo2maxTrend, paceRecords, volumeStats, hrSummary, rawRuns, plannedSessions] = await Promise.all([
    getVo2maxTrend(userId),
    getPaceRecords(userId),
    getVolumeStats(userId),
    getHrZonesSummary(userId),
    prisma.activity.findMany({
      where: { userId, type: ActivityType.RUN },
      orderBy: { startedAt: "desc" },
    }),
    prisma.trainingPlanSession.findMany({
      where: {
        userId,
        type: ActivityType.RUN,
        date: { gte: startOfDay(new Date()) },
      },
      include: { statuses: true },
      orderBy: { date: "asc" },
    }),
  ]);

  let zones = null;
  if (profile) {
    zones = computeZones({
      method: profile.zonesMethod,
      maxHr: profile.maxHr,
      restingHr: profile.restingHr,
      lthr: profile.lthr,
    });
  }

  const currentVdot = rawRuns.find((r) => r.vdotEstimate !== null)?.vdotEstimate ?? null;
  const weekKm = volumeStats?.thisWeekRunKm ?? 0;

  const profileSettings = (profile?.settings ?? {}) as Record<string, any>;
  const weeklyRunningTargetKm = profileSettings?.weeklyRunningTargetKm ?? 45;

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2b2d24] pb-5">
        <div>
          <p className="text-[10px] font-mono text-[#5d6050] mb-1">HealthOS / Bieg</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bieg</h1>
          <p className="text-sm text-[#8e9182] mt-1">
            dane ze Stravy i Garmina · {weekKm.toFixed(1)} km w tym tygodniu · cel: {profile ? weeklyRunningTargetKm.toString() : "—"} km
          </p>
        </div>
        <BiegUploadButton />
      </div>

      {/* Górny rząd KPI — 3 kolumny */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Vo2maxCard
          currentVdot={currentVdot}
          trendPoints={vo2maxTrend}
          birthDate={profile?.birthDate ? new Date(profile.birthDate) : null}
          gender={profile?.sex ?? null}
        />
        <PaceRecords records={paceRecords} />
        <VolumeRecords stats={volumeStats} weeklyTargetKm={weeklyRunningTargetKm} />
      </div>

      {/* Strefy tętna — pełna szerokość */}
      <HrZonesTable summary={hrSummary} zones={zones} />

      {/* Dwie kolumny: Historia (lewa) i Zaplanowane treningi (prawa) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <RunHistory activities={rawRuns as any} />
        </div>
        <div className="lg:col-span-4">
          <PlannedRuns sessions={plannedSessions as any} />
        </div>
      </div>
    </div>
  );
}

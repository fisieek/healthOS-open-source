import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { HrZoneMethod } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

interface ProfileInput {
  birthDate?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  maxHr?: number | null;
  restingHr?: number | null;
  lthr?: number | null;
  ftp?: number | null;
  vdot?: number | null;
  thresholdPace?: number | null;
  zonesMethod?: HrZoneMethod;
  weeklyRunningTargetKm?: number | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  return Response.json(profile);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProfileInput;

  // Validate
  if (body.maxHr != null && (body.maxHr < 100 || body.maxHr > 230)) {
    return Response.json({ error: "maxHr out of range (100-230)" }, { status: 400 });
  }
  if (body.restingHr != null && (body.restingHr < 30 || body.restingHr > 100)) {
    return Response.json({ error: "restingHr out of range (30-100)" }, { status: 400 });
  }
  if (body.lthr != null && (body.lthr < 100 || body.lthr > 220)) {
    return Response.json({ error: "lthr out of range (100-220)" }, { status: 400 });
  }

  const existingProfile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  });

  const data: Record<string, unknown> = {};
  if (body.birthDate !== undefined)
    data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if (body.sex !== undefined) data.sex = body.sex;
  if (body.heightCm !== undefined) data.heightCm = body.heightCm;
  if (body.maxHr !== undefined) data.maxHr = body.maxHr;
  if (body.restingHr !== undefined) data.restingHr = body.restingHr;
  if (body.lthr !== undefined) data.lthr = body.lthr;
  if (body.ftp !== undefined) data.ftp = body.ftp;
  if (body.vdot !== undefined) data.vdot = body.vdot;
  if (body.thresholdPace !== undefined) data.thresholdPace = body.thresholdPace;
  if (body.zonesMethod !== undefined) data.zonesMethod = body.zonesMethod;

  // Obsługa JSON settings w celu bezpiecznego zapisu celów bez nadpisywania np. integracji Runna
  const currentSettings = (existingProfile?.settings ?? {}) as Record<string, any>;
  let settingsUpdated = false;
  if (body.weeklyRunningTargetKm !== undefined) {
    currentSettings.weeklyRunningTargetKm = body.weeklyRunningTargetKm;
    settingsUpdated = true;
  }
  if (settingsUpdated || existingProfile?.settings === undefined) {
    data.settings = currentSettings;
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return Response.json(profile);
}

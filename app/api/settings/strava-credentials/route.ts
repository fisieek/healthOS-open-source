import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const settings = (profile?.settings ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    hasClientId: !!settings.stravaClientId,
    hasClientSecret: !!settings.stravaClientSecret,
    clientId: (settings.stravaClientId as string) ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, clientSecret } = await req.json();
  if (!clientId?.trim() || !clientSecret?.trim()) {
    return NextResponse.json({ error: "Brak wymaganych pól" }, { status: 400 });
  }

  const existing = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const settings = ((existing?.settings ?? {}) as Record<string, unknown>);
  settings.stravaClientId = clientId.trim();
  settings.stravaClientSecret = clientSecret.trim();

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, settings: settings as Prisma.InputJsonValue },
    update: { settings: settings as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const settings = ((existing?.settings ?? {}) as Record<string, unknown>);
  delete settings.stravaClientId;
  delete settings.stravaClientSecret;

  await prisma.userProfile.update({
    where: { userId: session.user.id },
    data: { settings: settings as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}

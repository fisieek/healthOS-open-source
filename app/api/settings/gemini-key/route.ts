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
  const key = (settings.geminiApiKey as string) ?? "";
  return NextResponse.json({
    hasKey: !!key,
    // Tylko podgląd ostatnich znaków, nigdy pełny klucz
    masked: key ? `…${key.slice(-4)}` : null,
    // Klucz może też pochodzić z env (web dev) — wtedy profil go nie ma, ale działa
    envFallback: !!process.env.GEMINI_API_KEY,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey } = await req.json();
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "Brak klucza API" }, { status: 400 });
  }

  const existing = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const settings = ((existing?.settings ?? {}) as Record<string, unknown>);
  settings.geminiApiKey = apiKey.trim();

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
  delete settings.geminiApiKey;

  await prisma.userProfile.update({
    where: { userId: session.user.id },
    data: { settings: settings as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true });
}

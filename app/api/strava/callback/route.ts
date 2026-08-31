import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { exchangeCode } from "@/lib/services/strava";
import { DataSourceType } from "@/app/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?strava=error", req.url));
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const s = (profile?.settings ?? {}) as Record<string, unknown>;
  const clientId = (s.stravaClientId as string) ?? process.env.STRAVA_CLIENT_ID ?? "";
  const clientSecret = (s.stravaClientSecret as string) ?? process.env.STRAVA_CLIENT_SECRET ?? "";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?strava=no-credentials", req.url));
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/strava/callback`;

  try {
    const tokens = await exchangeCode(code, redirectUri, clientId, clientSecret);

    await prisma.dataSource.upsert({
      where: {
        userId_type: { userId: session.user.id, type: DataSourceType.STRAVA },
      },
      create: {
        userId: session.user.id,
        type: DataSourceType.STRAVA,
        isActive: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        settings: { athleteId: tokens.athlete.id },
      },
      update: {
        isActive: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        settings: { athleteId: tokens.athlete.id },
      },
    });

    return NextResponse.redirect(new URL("/settings?strava=connected", req.url));
  } catch (err) {
    console.error("Strava callback error:", err);
    return NextResponse.redirect(new URL("/settings?strava=error", req.url));
  }
}

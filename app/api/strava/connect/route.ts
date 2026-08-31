import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStravaAuthUrl } from "@/lib/services/strava";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { settings: true },
  });

  const s = (profile?.settings ?? {}) as Record<string, unknown>;
  const clientId = (s.stravaClientId as string) ?? process.env.STRAVA_CLIENT_ID ?? "";

  if (!clientId) {
    return NextResponse.redirect(new URL("/settings?strava=no-credentials", req.url));
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/strava/callback`;
  const url = getStravaAuthUrl(redirectUri, clientId);
  return NextResponse.redirect(url);
}

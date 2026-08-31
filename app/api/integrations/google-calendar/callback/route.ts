import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma";
import {
  exchangeCode,
  getGoogleCredentials,
  googleRedirectUri,
} from "@/lib/services/google-calendar";
import { PKCE_COOKIE } from "@/lib/services/pkce";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?google=error", req.url));
  }

  const creds = await getGoogleCredentials(session.user.id);
  if (!creds) {
    return NextResponse.redirect(new URL("/settings?google=no-credentials", req.url));
  }

  // Bez `verifier` Google odrzuci wymianę — a jego brak oznacza, że ktoś
  // wszedł na ten adres z boku, nie przez nasz przycisk „Połącz".
  const verifier = req.cookies.get(PKCE_COOKIE)?.value;
  if (!verifier) {
    return NextResponse.redirect(new URL("/settings?google=pkce-missing", req.url));
  }

  try {
    const tokens = await exchangeCode(
      code,
      googleRedirectUri(),
      creds.clientId,
      creds.clientSecret,
      verifier
    );

    if (!tokens.refresh_token) {
      // Bez refresh tokenu integracja padnie po godzinie i nie da się jej
      // odnowić. Zwykle znaczy to, że użytkownik zgadzał się już wcześniej,
      // a Google wydaje go tylko przy pierwszej zgodzie (stąd prompt=consent).
      return NextResponse.redirect(new URL("/settings?google=no-refresh-token", req.url));
    }

    await prisma.dataSource.upsert({
      where: {
        userId_type: { userId: session.user.id, type: DataSourceType.GOOGLE_CALENDAR },
      },
      create: {
        userId: session.user.id,
        type: DataSourceType.GOOGLE_CALENDAR,
        // 🛑 Świadomie NIEAKTYWNE po podłączeniu. Samo połączenie konta nie może
        // nic wysłać — pierwszy wysył idzie dopiero za jawnym potwierdzeniem
        // („wyślę N zdarzeń"), zgodnie z ustaleniami o prywatności.
        isActive: false,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        settings: {},
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    const ok = NextResponse.redirect(new URL("/settings?google=connected", req.url));
    ok.cookies.delete(PKCE_COOKIE);
    return ok;
  } catch (err) {
    console.error("Google Calendar callback error:", err);
    const fail = NextResponse.redirect(new URL("/settings?google=error", req.url));
    fail.cookies.delete(PKCE_COOKIE);
    return fail;
  }
}

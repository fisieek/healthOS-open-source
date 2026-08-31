import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getGoogleAuthUrl,
  getGoogleCredentials,
  googleRedirectUri,
} from "@/lib/services/google-calendar";
import { createPkcePair, PKCE_COOKIE } from "@/lib/services/pkce";

export const runtime = "nodejs";

/** Przekierowanie na ekran zgody Google. Wzorzec: `app/api/strava/connect`. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const creds = await getGoogleCredentials(session.user.id);
  if (!creds) {
    return NextResponse.redirect(new URL("/settings?google=no-credentials", req.url));
  }

  const { verifier, challenge } = createPkcePair();

  const res = NextResponse.redirect(
    getGoogleAuthUrl(googleRedirectUri(), creds.clientId, challenge)
  );

  // `verifier` musi przeżyć podróż do Google i z powrotem, ale NIE może
  // opuścić tego komputera — stąd ciasteczko httpOnly zamiast parametru URL.
  res.cookies.set(PKCE_COOKIE, verifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minut — tyle, ile realnie trwa klikanie zgody
  });

  return res;
}

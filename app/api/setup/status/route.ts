import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/setup/status
 * 
 * Zwraca informację o stanie instalacji:
 * - hasUsers: false → first-run, pokaż onboarding/register
 * - hasUsers: true  → normalne logowanie
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      hasUsers: userCount > 0,
      userCount,
    });
  } catch (error: any) {
    console.error("[SetupStatus] Błąd:", error.message);
    return NextResponse.json(
      { hasUsers: false, userCount: 0, error: "db_error" },
      { status: 500 }
    );
  }
}

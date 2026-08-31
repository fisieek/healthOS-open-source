import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getDefaultBiomarkersWithIds } from "@/lib/constants/biomarkers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, password } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Wszystkie pola są wymagane." },
        { status: 400 }
      );
    }

    // 1. Sprawdź, czy użytkownik o tym mailu już istnieje
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Użytkownik o tym adresie e-mail już istnieje." },
        { status: 400 }
      );
    }

    // 2. Zahashuj hasło za pomocą bcryptjs
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Utwórz użytkownika wraz z domyślnym profilem biomarkerów
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
        profile: {
          create: {
            settings: { biomarkers: getDefaultBiomarkersWithIds() } as any
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    return NextResponse.json({
      success: true,
      user: newUser
    });
  } catch (error: any) {
    console.error("[RegisterAPI] Błąd podczas rejestracji użytkownika:", error);
    return NextResponse.json(
      { error: "Wystąpił wewnętrzny błąd serwera." },
      { status: 500 }
    );
  }
}

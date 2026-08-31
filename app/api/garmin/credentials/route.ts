import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: "Email i hasło są wymagane" }, { status: 400 });
  }

  try {
    const dataSource = await prisma.dataSource.upsert({
      where: { userId_type: { userId, type: DataSourceType.GARMIN } },
      create: {
        userId,
        type: DataSourceType.GARMIN,
        isActive: true,
        settings: { email, password },
      },
      update: {
        isActive: true,
        settings: { email, password },
      },
    });

    return Response.json({ ok: true, id: dataSource.id });
  } catch (err) {
    console.error("Błąd zapisu poświadczeń Garmin:", err);
    return Response.json({ error: "Wystąpił błąd podczas zapisywania poświadczeń" }, { status: 500 });
  }
}

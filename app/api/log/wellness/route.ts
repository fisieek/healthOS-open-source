import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { date, energyScore, moodScore, stressScore, notes } = body;

  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const dateObj = new Date(date);

  const entry = await prisma.wellnessEntry.upsert({
    where: { userId_date: { userId: session.user.id, date: dateObj } },
    create: {
      userId: session.user.id,
      date: dateObj,
      energyScore: energyScore ?? null,
      moodScore: moodScore ?? null,
      stressScore: stressScore ?? null,
      notes: notes || null,
    },
    update: {
      energyScore: energyScore ?? null,
      moodScore: moodScore ?? null,
      stressScore: stressScore ?? null,
      notes: notes || null,
    },
  });

  return Response.json({ ok: true, id: entry.id });
}

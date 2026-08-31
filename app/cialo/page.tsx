import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import { BodyClient } from "./body-client";

export const runtime = "nodejs";

export default async function CialoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // 1. Pobieranie danych sylwetki i profilu
  const [measurements, profile] = await Promise.all([
    prisma.bodyMeasurement.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: { sex: true },
    }),
  ]);

  return (
    <BodyClient
      initialMeasurements={measurements}
      userSex={profile?.sex ?? "M"}
    />
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { listDictionaries } from "@/lib/services/medical-dictionaries";
import { DictionariesClient } from "./dictionaries-client";

export const runtime = "nodejs";

export default async function SlownikiPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [dicts, visits, docs] = await Promise.all([
    listDictionaries(userId),
    prisma.medicalVisit.findMany({
      where: { userId },
      select: { doctorId: true, facilityId: true, bodyPartId: true },
    }),
    prisma.healthDocument.findMany({
      where: { userId },
      select: {
        orderingDoctorId: true,
        performingDoctorId: true,
        facilityId: true,
        bodyPartId: true,
      },
    }),
  ]);

  // Liczniki użycia per wpis
  const doctorUsage: Record<string, number> = {};
  const facilityUsage: Record<string, number> = {};
  const bodyPartUsage: Record<string, number> = {};
  const bump = (map: Record<string, number>, id: string | null) => {
    if (id) map[id] = (map[id] ?? 0) + 1;
  };
  for (const v of visits) {
    bump(doctorUsage, v.doctorId);
    bump(facilityUsage, v.facilityId);
    bump(bodyPartUsage, v.bodyPartId);
  }
  for (const d of docs) {
    bump(doctorUsage, d.orderingDoctorId);
    bump(doctorUsage, d.performingDoctorId);
    bump(facilityUsage, d.facilityId);
    bump(bodyPartUsage, d.bodyPartId);
  }

  return (
    <DictionariesClient
      doctors={dicts.doctors.map((d) => ({ ...d, usage: doctorUsage[d.id] ?? 0 }))}
      facilities={dicts.facilities.map((f) => ({ ...f, usage: facilityUsage[f.id] ?? 0 }))}
      bodyParts={dicts.bodyParts.map((b) => ({ ...b, usage: bodyPartUsage[b.id] ?? 0 }))}
    />
  );
}

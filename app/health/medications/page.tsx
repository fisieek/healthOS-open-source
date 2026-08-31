import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Pill } from "lucide-react";
import { MedicationManager } from "./medication-form";

export default async function MedicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const medications = await prisma.medication.findMany({
    where: { userId: session.user.id },
    orderBy: { startDate: "desc" },
  });

  const serialized = medications.map((m) => ({
    id: m.id,
    name: m.name,
    dose: m.dose,
    frequency: m.frequency,
    startDate: m.startDate.toISOString(),
    endDate: m.endDate?.toISOString() ?? null,
    notes: m.notes,
  }));

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Pill className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Leki</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Aktywne i historyczne leki</p>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-border bg-card">
        <MedicationManager medications={serialized} />
      </div>
    </div>
  );
}

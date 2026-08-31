import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FlaskConical } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { SupplementManager } from "./supplement-form";
import Link from "next/link";

export default async function SupplementsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const [supplements, todayIntakes, nutrients] = await Promise.all([
    prisma.supplement.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      include: {
        ingredients: {
          orderBy: { name: "asc" },
          include: { nutrient: { select: { id: true, slug: true, name: true } } },
        },
      },
    }),
    prisma.supplementIntake.findMany({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
      orderBy: { takenAt: "desc" },
    }),
    prisma.nutrient.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, slug: true, name: true, defaultUnit: true },
    }),
  ]);

  const serialized = supplements.map((s) => ({
    id: s.id,
    name: s.name,
    productName: s.productName,
    company: s.company,
    dose: s.dose,
    servingSize: s.servingSize,
    servingUnit: s.servingUnit,
    goal: s.goal,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate?.toISOString() ?? null,
    notes: s.notes,
    ingredients: s.ingredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      percentDV: ing.percentDV,
      nutrientId: ing.nutrientId,
      nutrientName: ing.nutrient?.name ?? null,
    })),
  }));

  const intakesSerialized = todayIntakes.map((i) => ({
    id: i.id,
    supplementId: i.supplementId,
    portion: i.portion,
    takenAt: i.takenAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Suplementy</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Zarządzanie suplementami i dziennik dawkowania
            </p>
          </div>
        </div>
        <Link
          href="/health/nutrients"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mt-1.5"
        >
          Profil mikroelementów →
        </Link>
      </div>

      <SupplementManager
        supplements={serialized}
        todayIntakes={intakesSerialized}
        nutrients={nutrients}
      />
    </div>
  );
}

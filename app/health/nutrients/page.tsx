import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import { Sparkles, AlertTriangle, Check, Minus } from "lucide-react";
import { convertAmount } from "@/lib/services/nutrients";
import { NutrientCategory } from "@/app/generated/prisma/client";

const categoryLabels: Record<NutrientCategory, string> = {
  VITAMIN: "Witaminy",
  MINERAL: "Minerały",
  FATTY_ACID: "Kwasy tłuszczowe",
  AMINO_ACID: "Aminokwasy",
  HERB: "Zioła / adaptogeny",
  PROBIOTIC: "Probiotyki",
  OTHER: "Inne",
};

interface NutrientRow {
  id: string;
  slug: string;
  name: string;
  category: NutrientCategory;
  defaultUnit: string;
  rda: number | null;
  upperLimit: number | null;
  // computed
  takenToday: number; // amount in default unit
  takenTodayUnit: string;
  percentRdaToday: number | null;
  inActive: boolean; // present in any active supplement
  everTaken: boolean; // present in any supplement (active or past) with intake history
  status: "taken" | "active-not-taken" | "owned-archived" | "never";
  sourceSupplements: string[];
}

export default async function NutrientsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const todayDateOnly = today.toISOString().slice(0, 10);

  const [nutrients, supplements, todayIntakes] = await Promise.all([
    prisma.nutrient.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.supplement.findMany({
      where: { userId },
      include: {
        ingredients: {
          where: { nutrientId: { not: null } },
          include: { nutrient: { select: { id: true, slug: true, defaultUnit: true } } },
        },
      },
    }),
    prisma.supplementIntake.findMany({
      where: { userId, date: { gte: todayStart, lte: todayEnd } },
    }),
  ]);

  // Build maps
  const intakesBySupplement = new Map<string, number>(); // total portion taken today
  for (const i of todayIntakes) {
    intakesBySupplement.set(i.supplementId, (intakesBySupplement.get(i.supplementId) ?? 0) + i.portion);
  }

  const supplementsByNutrient = new Map<string, { name: string; isActive: boolean }[]>();
  const todayAmountByNutrient = new Map<string, number>(); // in default unit

  for (const sup of supplements) {
    const supActive = !sup.endDate || sup.endDate >= new Date(todayDateOnly);
    const portionToday = intakesBySupplement.get(sup.id) ?? 0;

    for (const ing of sup.ingredients) {
      if (!ing.nutrientId || !ing.nutrient) continue;

      const list = supplementsByNutrient.get(ing.nutrientId) ?? [];
      list.push({ name: sup.name, isActive: supActive });
      supplementsByNutrient.set(ing.nutrientId, list);

      // Compute today's intake in default unit
      if (portionToday > 0 && ing.amount != null) {
        const converted = convertAmount(
          ing.amount * portionToday,
          ing.unit,
          ing.nutrient.defaultUnit,
          ing.nutrient.slug
        );
        if (converted != null) {
          const cur = todayAmountByNutrient.get(ing.nutrientId) ?? 0;
          todayAmountByNutrient.set(ing.nutrientId, cur + converted);
        }
      }
    }
  }

  // Build rows
  const rows: NutrientRow[] = nutrients.map((n) => {
    const sources = supplementsByNutrient.get(n.id) ?? [];
    const inActive = sources.some((s) => s.isActive);
    const taken = todayAmountByNutrient.get(n.id) ?? 0;
    const status: NutrientRow["status"] = taken > 0
      ? "taken"
      : inActive
        ? "active-not-taken"
        : sources.length > 0
          ? "owned-archived"
          : "never";

    return {
      id: n.id,
      slug: n.slug,
      name: n.name,
      category: n.category,
      defaultUnit: n.defaultUnit,
      rda: n.rda,
      upperLimit: n.upperLimit,
      takenToday: taken,
      takenTodayUnit: n.defaultUnit,
      percentRdaToday: n.rda && n.rda > 0 ? (taken / n.rda) * 100 : null,
      inActive,
      everTaken: sources.length > 0,
      status,
      sourceSupplements: Array.from(new Set(sources.map((s) => s.name))),
    };
  });

  // Group by category
  const byCategory = new Map<NutrientCategory, NutrientRow[]>();
  for (const r of rows) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  // Stats
  const totalNutrients = rows.length;
  const takenCount = rows.filter((r) => r.status === "taken").length;
  const activeCount = rows.filter((r) => r.inActive).length;
  const neverCount = rows.filter((r) => r.status === "never").length;
  const overUlCount = rows.filter((r) => r.upperLimit && r.takenToday > r.upperLimit).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">Profil mikroelementów</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pełna lista nutrientów × Twoja suplementacja × dzisiejsza realizacja % RWS
          </p>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Wzięte dziś" value={`${takenCount}/${totalNutrients}`} accent="green" />
        <StatCard label="W aktywnych supl." value={`${activeCount}/${totalNutrients}`} />
        <StatCard label="Nigdy nie brałem" value={`${neverCount}`} muted />
        <StatCard
          label="Powyżej UL"
          value={`${overUlCount}`}
          accent={overUlCount > 0 ? "red" : undefined}
        />
      </div>

      {overUlCount > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>{overUlCount}</strong>{" "}
            {overUlCount === 1 ? "nutrient przekracza" : "nutrienty przekraczają"} górny limit (UL).
            Sprawdź dzisiejsze dawki.
          </span>
        </div>
      )}

      {/* Tables per category */}
      {Array.from(byCategory.entries()).map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {categoryLabels[cat]} ({list.length})
          </h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Nutrient</th>
                  <th className="text-right px-3 py-2 font-medium">Dziś</th>
                  <th className="text-right px-3 py-2 font-medium">RWS</th>
                  <th className="text-right px-3 py-2 font-medium w-32">% RWS</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((row) => (
                  <NutrientRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
  muted?: boolean;
}) {
  const accentClass =
    accent === "green"
      ? "text-green-600 dark:text-green-500"
      : accent === "red"
        ? "text-red-600 dark:text-red-500"
        : muted
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function NutrientRow({ row }: { row: NutrientRow }) {
  const overUl = row.upperLimit != null && row.takenToday > row.upperLimit;

  return (
    <tr className={overUl ? "bg-red-500/5" : ""}>
      <td className="px-3 py-2">
        <div className="font-medium">{row.name}</div>
        {row.sourceSupplements.length > 0 && (
          <div className="text-xs text-muted-foreground truncate max-w-xs">
            {row.sourceSupplements.slice(0, 2).join(", ")}
            {row.sourceSupplements.length > 2 ? ` +${row.sourceSupplements.length - 2}` : ""}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {row.takenToday > 0 ? (
          <span className="font-medium">
            {formatAmount(row.takenToday)} {row.takenTodayUnit}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
        {row.rda != null ? `${formatAmount(row.rda)} ${row.defaultUnit}` : "—"}
      </td>
      <td className="px-3 py-2">
        {row.percentRdaToday != null && row.takenToday > 0 ? (
          <PercentBar percent={row.percentRdaToday} overUl={overUl} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

function PercentBar({ percent, overUl }: { percent: number; overUl: boolean }) {
  const clamped = Math.min(percent, 200);
  const color = overUl
    ? "bg-red-500"
    : percent >= 100
      ? "bg-green-500"
      : percent >= 50
        ? "bg-yellow-500"
        : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${(clamped / 200) * 100}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: NutrientRow["status"] }) {
  switch (status) {
    case "taken":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/40 px-1.5 py-0.5 rounded">
          <Check className="h-3 w-3" /> Wzięte
        </span>
      );
    case "active-not-taken":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-950/40 px-1.5 py-0.5 rounded">
          Nie wziąłem
        </span>
      );
    case "owned-archived":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          Archiwum
        </span>
      );
    case "never":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
          <Minus className="h-3 w-3" /> Nie biorę
        </span>
      );
  }
}

function formatAmount(n: number): string {
  if (n >= 1000) return n.toFixed(0);
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

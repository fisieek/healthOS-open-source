import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ImageIcon, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { BodyEditPanel } from "./body-edit-panel";

interface KpiSpec {
  label: string;
  value: string;
  delta: { v: number; positive: boolean } | null;
  /**
   * For % deltas: when goingUp = "good" (e.g. muscle %), positive=true means
   * green (going in the right direction). For tłuszcz / tłuszcz trzewny: opposite.
   */
  goodWhenUp: boolean;
}

function fmtKg(v: number | null): string {
  return v != null ? `${v.toFixed(1)} kg` : "—";
}
function fmtPct(v: number | null): string {
  return v != null ? `${v.toFixed(1)}%` : "—";
}
function fmtNum(v: number | null, dec = 1, suffix = ""): string {
  return v != null ? `${v.toFixed(dec)}${suffix}` : "—";
}

function delta(curr: number | null, prev: number | null) {
  if (curr == null || prev == null) return null;
  const v = curr - prev;
  if (Math.abs(v) < 1e-6) return null;
  return { v, positive: v > 0 };
}

function deltaClass(d: KpiSpec["delta"], goodWhenUp: boolean): string {
  if (!d) return "text-muted-foreground";
  const good = goodWhenUp ? d.positive : !d.positive;
  return good ? "text-green-600" : "text-red-500";
}

export default async function BodyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const m = await prisma.bodyMeasurement.findUnique({ where: { id } });
  if (!m || m.userId !== session.user.id) notFound();

  // Find previous measurement for delta computation
  const prev = await prisma.bodyMeasurement.findFirst({
    where: { userId: session.user.id, date: { lt: m.date } },
    orderBy: { date: "desc" },
  });

  const dateIso = format(m.date, "yyyy-MM-dd");

  const kpis: KpiSpec[] = [
    {
      label: "Waga",
      value: fmtKg(m.weight),
      delta: delta(m.weight, prev?.weight ?? null),
      goodWhenUp: false, // assume we generally want lower; ambivalent really
    },
    {
      label: "BMI",
      value: fmtNum(m.bmi, 1),
      delta: delta(m.bmi, prev?.bmi ?? null),
      goodWhenUp: false,
    },
    {
      label: "Tłuszcz",
      value: fmtPct(m.bodyFat),
      delta: delta(m.bodyFat, prev?.bodyFat ?? null),
      goodWhenUp: false,
    },
    {
      label: "Mięśnie",
      value: fmtKg(m.muscleMass),
      delta: delta(m.muscleMass, prev?.muscleMass ?? null),
      goodWhenUp: true,
    },
    {
      label: "Beztłuszczowa",
      value: fmtKg(m.leanBodyMass),
      delta: delta(m.leanBodyMass, prev?.leanBodyMass ?? null),
      goodWhenUp: true,
    },
    {
      label: "Kości",
      value: fmtKg(m.boneMass),
      delta: delta(m.boneMass, prev?.boneMass ?? null),
      goodWhenUp: true,
    },
    {
      label: "Woda",
      value: fmtPct(m.bodyWaterPct),
      delta: delta(m.bodyWaterPct, prev?.bodyWaterPct ?? null),
      goodWhenUp: true,
    },
    {
      label: "Białko",
      value: fmtPct(m.proteinPct),
      delta: delta(m.proteinPct, prev?.proteinPct ?? null),
      goodWhenUp: true,
    },
    {
      label: "Tłuszcz trzewny",
      value: fmtNum(m.visceralFat, 0),
      delta: delta(m.visceralFat, prev?.visceralFat ?? null),
      goodWhenUp: false,
    },
    {
      label: "BMR",
      value: m.basalMetabolism != null ? `${m.basalMetabolism} kcal` : "—",
      delta: delta(m.basalMetabolism, prev?.basalMetabolism ?? null),
      goodWhenUp: true,
    },
    {
      label: "Wiek metab.",
      value: m.metabolicAge != null ? `${m.metabolicAge} lat` : "—",
      delta: delta(m.metabolicAge, prev?.metabolicAge ?? null),
      goodWhenUp: false,
    },
    {
      label: "Body score",
      value: m.bodyScore != null ? `${m.bodyScore}/100` : "—",
      delta: delta(m.bodyScore, prev?.bodyScore ?? null),
      goodWhenUp: true,
    },
    {
      label: "Idealna waga",
      value: fmtKg(m.idealWeight),
      delta: null,
      goodWhenUp: true,
    },
    {
      label: "Mięśnie szkiel.",
      value: fmtPct(m.skeletalMusclePct),
      delta: delta(m.skeletalMusclePct, prev?.skeletalMusclePct ?? null),
      goodWhenUp: true,
    },
    // Nowe wskaźniki
    {
      label: "Masa wody",
      value: fmtKg(m.waterMass),
      delta: delta(m.waterMass, prev?.waterMass ?? null),
      goodWhenUp: true,
    },
    {
      label: "Masa tłuszczu",
      value: fmtKg(m.fatMass),
      delta: delta(m.fatMass, prev?.fatMass ?? null),
      goodWhenUp: false,
    },
    {
      label: "Masa białka",
      value: fmtKg(m.proteinMass),
      delta: delta(m.proteinMass, prev?.proteinMass ?? null),
      goodWhenUp: true,
    },
    {
      label: "Procent mięśni",
      value: fmtPct(m.musclePct),
      delta: delta(m.musclePct, prev?.musclePct ?? null),
      goodWhenUp: true,
    },
    {
      label: "Procent kości",
      value: fmtPct(m.bonePct),
      delta: delta(m.bonePct, prev?.bonePct ?? null),
      goodWhenUp: true,
    },
    {
      label: "Masa miśni szkiel.",
      value: fmtKg(m.skeletalMuscleMass),
      delta: delta(m.skeletalMuscleMass, prev?.skeletalMuscleMass ?? null),
      goodWhenUp: true,
    },
    {
      label: "Wskaźnik WHR",
      value: fmtNum(m.waistToHipRatio, 2),
      delta: delta(m.waistToHipRatio, prev?.waistToHipRatio ?? null),
      goodWhenUp: false,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-3 min-w-0">
        <Link
          href="/health/body"
          className="text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              Pomiar ciała
            </Badge>
            {m.source === "PHOTO" && (
              <Badge variant="outline" className="text-[10px]">
                AI · {m.sourceLabel ?? "zdjęcie"}
              </Badge>
            )}
            {m.source === "MANUAL" && (
              <Badge variant="outline" className="text-[10px]">
                Ręczny
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-1 capitalize">
            {format(m.date, "EEEE, d MMMM yyyy", { locale: pl })}
          </h1>
          {m.measuredAt && (
            <p className="text-sm text-muted-foreground">
              Zmierzono: {format(m.measuredAt, "d MMM yyyy 'o' HH:mm", { locale: pl })}
            </p>
          )}
          {m.bodyType && (
            <p className="text-sm text-muted-foreground italic mt-0.5">
              Typ sylwetki: {m.bodyType}
            </p>
          )}
        </div>
      </div>

      {/* Two-column: photo + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Photo */}
        <div className="lg:col-span-1">
          {m.photoUrl ? (
            <a
              href={m.photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-border bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.photoUrl} alt="" className="w-full object-contain" />
            </a>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-xs text-center">Brak zdjęcia</p>
              <p className="text-[10px] text-center mt-1">
                Pomiar wprowadzony ręcznie
              </p>
            </div>
          )}
        </div>

        {/* KPIs grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-base font-bold">{k.value}</span>
                  {k.delta && (
                    <span
                      className={`text-[10px] inline-flex items-center gap-0.5 ${deltaClass(
                        k.delta,
                        k.goodWhenUp
                      )}`}
                    >
                      {k.delta.positive ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5" />
                      )}
                      {k.delta.positive ? "+" : ""}
                      {k.delta.v.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {m.notes && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Notatki
              </p>
              <p className="text-sm whitespace-pre-wrap">{m.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit / delete */}
      <BodyEditPanel
        initial={{
          id: m.id,
          date: dateIso,
          sourceLabel: m.sourceLabel,
          weight: m.weight,
          bmi: m.bmi,
          bodyFat: m.bodyFat,
          leanBodyMass: m.leanBodyMass,
          muscleMass: m.muscleMass,
          boneMass: m.boneMass,
          bodyWaterPct: m.bodyWaterPct,
          proteinPct: m.proteinPct,
          visceralFat: m.visceralFat,
          basalMetabolism: m.basalMetabolism,
          metabolicAge: m.metabolicAge,
          bodyType: m.bodyType,
          bodyScore: m.bodyScore,
          idealWeight: m.idealWeight,
          skeletalMusclePct: m.skeletalMusclePct,
          height: m.height,
          notes: m.notes,
          // Nowe wskaźniki
          waterMass: m.waterMass,
          fatMass: m.fatMass,
          proteinMass: m.proteinMass,
          musclePct: m.musclePct,
          bonePct: m.bonePct,
          skeletalMuscleMass: m.skeletalMuscleMass,
          waistToHipRatio: m.waistToHipRatio,
        }}
      />
    </div>
  );
}

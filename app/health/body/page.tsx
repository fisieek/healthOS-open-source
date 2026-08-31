import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { pl } from "date-fns/locale";
import { ImageIcon, Sparkles, Plus } from "lucide-react";
import {
  WeightBmiChart,
  FatMuscleChart,
  WaterVisceralChart,
  ScoreAgeChart,
  type BodyTimelinePoint,
} from "./charts";
import { IntakeFlow } from "@/components/health-intake/intake-flow";

export default async function BodyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const since = subDays(new Date(), 365);

  const measurements = await prisma.bodyMeasurement.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const recent = [...measurements].reverse().slice(0, 30);
  const latest = recent[0] ?? null;

  const timeline: BodyTimelinePoint[] = measurements.map((m) => ({
    date: format(m.date, "d MMM", { locale: pl }),
    weight: m.weight,
    bmi: m.bmi,
    bodyFat: m.bodyFat,
    muscleMass: m.muscleMass,
    bodyWaterPct: m.bodyWaterPct,
    visceralFat: m.visceralFat,
    basalMetabolism: m.basalMetabolism,
    bodyScore: m.bodyScore,
    metabolicAge: m.metabolicAge,
  }));

  const todayIso = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sylwetka</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Skład ciała, masa, BMI, tłuszcz trzewny — wszystkie pomiary w jednym miejscu
          </p>
        </div>
        {latest && (
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Ostatni pomiar</p>
              <p className="font-medium">
                {format(latest.date, "d MMMM yyyy", { locale: pl })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Latest summary */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <KpiCard label="Waga" value={fmtKg(latest.weight)} />
          <KpiCard label="BMI" value={fmtNum(latest.bmi, 1)} />
          <KpiCard label="Tłuszcz" value={fmtPct(latest.bodyFat)} />
          <KpiCard label="Mięśnie" value={fmtKg(latest.muscleMass)} />
          <KpiCard label="Woda" value={fmtPct(latest.bodyWaterPct)} />
          <KpiCard label="Trzewny" value={fmtNum(latest.visceralFat, 0)} />
          <KpiCard
            label="Body score"
            value={latest.bodyScore != null ? `${latest.bodyScore}/100` : "—"}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Masa + BMI</CardTitle>
          </CardHeader>
          <CardContent>
            <WeightBmiChart data={timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tłuszcz vs mięśnie</CardTitle>
          </CardHeader>
          <CardContent>
            <FatMuscleChart data={timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Woda + tłuszcz trzewny</CardTitle>
          </CardHeader>
          <CardContent>
            <WaterVisceralChart data={timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Body score + wiek metaboliczny</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreAgeChart data={timeline} />
          </CardContent>
        </Card>
      </div>

      {/* Quick upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Dodaj pomiar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IntakeFlow defaultDate={todayIso} />
        </CardContent>
      </Card>

      {/* Measurements list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Historia ({measurements.length})
        </h2>
        {recent.length === 0 ? (
          <div className="p-8 rounded-lg border border-dashed border-border bg-card text-center text-sm text-muted-foreground">
            Brak pomiarów. Wgraj zdjęcie z wagi lub dodaj ręcznie w <Link href="/log" className="underline">Dziennik</Link>.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((m) => (
              <Link
                key={m.id}
                href={`/health/body/${m.id}`}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors"
              >
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photoUrl}
                    alt=""
                    className="h-14 w-14 rounded-md object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {format(m.date, "EEEE, d MMM yyyy", { locale: pl })}
                    </span>
                    {m.source === "PHOTO" && (
                      <Badge variant="secondary" className="text-[10px]">
                        AI {m.sourceLabel ? `· ${m.sourceLabel}` : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {m.weight != null && <span>{m.weight.toFixed(1)} kg</span>}
                    {m.bmi != null && <span>BMI {m.bmi.toFixed(1)}</span>}
                    {m.bodyFat != null && <span>{m.bodyFat.toFixed(1)}% tł.</span>}
                    {m.muscleMass != null && <span>{m.muscleMass.toFixed(1)} kg mięśni</span>}
                    {m.bodyScore != null && <span>score {m.bodyScore}/100</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function fmtKg(v: number | null): string {
  return v != null ? `${v.toFixed(1)} kg` : "—";
}
function fmtPct(v: number | null): string {
  return v != null ? `${v.toFixed(1)}%` : "—";
}
function fmtNum(v: number | null, decimals: number): string {
  return v != null ? v.toFixed(decimals) : "—";
}

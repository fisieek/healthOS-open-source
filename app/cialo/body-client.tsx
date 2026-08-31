"use client";

import { useState, useRef } from "react";
import { format, subDays, isAfter } from "date-fns";
import { pl } from "date-fns/locale";
import { CombinedBodyChart, type BodyTimelinePoint, ParameterTrendChart, TOOLTIP_STYLE, LABEL_STYLE } from "./charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Scale, Ruler, FlaskConical, TrendingUp, Info, Bell,
  Activity, Droplet, Flame, Award, Heart, Sparkles, Dumbbell,
  User, Target, X, ChevronDown, ChevronUp, History,
} from "lucide-react";
import BodyMeasurementModal from "@/components/cialo/body-measurement-modal";

interface BodyClientProps {
  initialMeasurements: any[];
  userSex: string;
}

// ─── Trend Chart Group Definition ──────────────────────────────────────────────

interface TrendChartDef {
  primaryKey: string;
  primaryLabel: string;
  primaryUnit: string;
  primaryColor: string;
  decimals?: number;
  goodWhenUp?: boolean;
  secondaryKey?: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  secondaryColor?: string;
  secondaryDecimals?: number;
  secondaryGoodWhenUp?: boolean;
  icon: React.ReactNode;
}

const TREND_CHARTS: TrendChartDef[] = [
  { primaryKey: "bmi", primaryLabel: "BMI", primaryUnit: "", primaryColor: "#8b5cf6", decimals: 1, goodWhenUp: false, icon: <Target className="h-4 w-4" /> },
  { primaryKey: "metabolicAge", primaryLabel: "Wiek metaboliczny", primaryUnit: " lat", primaryColor: "#06b6d4", decimals: 0, goodWhenUp: false, icon: <User className="h-4 w-4" /> },
  { primaryKey: "basalMetabolism", primaryLabel: "BMR (Metabolizm)", primaryUnit: " kcal", primaryColor: "#ef4444", decimals: 0, goodWhenUp: true, icon: <Flame className="h-4 w-4" /> },
  { primaryKey: "visceralFat", primaryLabel: "Tłuszcz trzewny", primaryUnit: "", primaryColor: "#f97316", decimals: 0, goodWhenUp: false, icon: <Activity className="h-4 w-4" /> },
  { primaryKey: "leanBodyMass", primaryLabel: "Masa beztłuszczowa", primaryUnit: " kg", primaryColor: "#10b981", decimals: 1, goodWhenUp: true, icon: <Scale className="h-4 w-4" /> },
  // Dual charts
  {
    primaryKey: "skeletalMuscleMass", primaryLabel: "Mięśnie szkieletowe", primaryUnit: " kg", primaryColor: "#bce663", decimals: 1, goodWhenUp: true,
    secondaryKey: "musclePct", secondaryLabel: "Procent mięśni", secondaryUnit: "%", secondaryColor: "#a3e635", secondaryDecimals: 1, secondaryGoodWhenUp: true,
    icon: <Dumbbell className="h-4 w-4" />,
  },
  {
    primaryKey: "fatMass", primaryLabel: "Masa tłuszczu", primaryUnit: " kg", primaryColor: "#fb923c", decimals: 1, goodWhenUp: false,
    secondaryKey: "bodyFat", secondaryLabel: "Procent tłuszczu", secondaryUnit: "%", secondaryColor: "#fdba74", secondaryDecimals: 1, secondaryGoodWhenUp: false,
    icon: <Activity className="h-4 w-4" />,
  },
  {
    primaryKey: "waterMass", primaryLabel: "Masa wody", primaryUnit: " kg", primaryColor: "#38bdf8", decimals: 1, goodWhenUp: true,
    secondaryKey: "bodyWaterPct", secondaryLabel: "Procent wody", secondaryUnit: "%", secondaryColor: "#7dd3fc", secondaryDecimals: 1, secondaryGoodWhenUp: true,
    icon: <Droplet className="h-4 w-4" />,
  },
  {
    primaryKey: "proteinMass", primaryLabel: "Masa białka", primaryUnit: " kg", primaryColor: "#f472b6", decimals: 1, goodWhenUp: true,
    secondaryKey: "proteinPct", secondaryLabel: "Procent białka", secondaryUnit: "%", secondaryColor: "#f9a8d4", secondaryDecimals: 1, secondaryGoodWhenUp: true,
    icon: <Heart className="h-4 w-4" />,
  },
  {
    primaryKey: "boneMass", primaryLabel: "Masa kości", primaryUnit: " kg", primaryColor: "#fbbf24", decimals: 1, goodWhenUp: true,
    secondaryKey: "bonePct", secondaryLabel: "Procent kości", secondaryUnit: "%", secondaryColor: "#fcd34d", secondaryDecimals: 1, secondaryGoodWhenUp: true,
    icon: <Award className="h-4 w-4" />,
  },
  { primaryKey: "idealWeight", primaryLabel: "Waga idealna", primaryUnit: " kg", primaryColor: "#a78bfa", decimals: 1, goodWhenUp: true, icon: <Target className="h-4 w-4" /> },
  { primaryKey: "waistToHipRatio", primaryLabel: "Wskaźnik WHR", primaryUnit: "", primaryColor: "#34d399", decimals: 2, goodWhenUp: false, icon: <Ruler className="h-4 w-4" /> },
];

const CIRCUMFERENCE_CHARTS: TrendChartDef[] = [
  { primaryKey: "chest", primaryLabel: "Klatka piersiowa", primaryUnit: " cm", primaryColor: "#3b82f6", decimals: 1, goodWhenUp: false, icon: <Ruler className="h-4 w-4" /> },
  { primaryKey: "waist", primaryLabel: "Talia / Pas", primaryUnit: " cm", primaryColor: "#10b981", decimals: 1, goodWhenUp: false, icon: <Ruler className="h-4 w-4" /> },
  { primaryKey: "hips", primaryLabel: "Biodra", primaryUnit: " cm", primaryColor: "#f59e0b", decimals: 1, goodWhenUp: false, icon: <Ruler className="h-4 w-4" /> },
  { primaryKey: "thigh", primaryLabel: "Udo", primaryUnit: " cm", primaryColor: "#ec4899", decimals: 1, goodWhenUp: false, icon: <Ruler className="h-4 w-4" /> },
  { primaryKey: "bicep", primaryLabel: "Biceps", primaryUnit: " cm", primaryColor: "#14b8a6", decimals: 1, goodWhenUp: true, icon: <Ruler className="h-4 w-4" /> },
  { primaryKey: "calf", primaryLabel: "Łydka", primaryUnit: " cm", primaryColor: "#6366f1", decimals: 1, goodWhenUp: true, icon: <Ruler className="h-4 w-4" /> },
  { primaryKey: "shoulder", primaryLabel: "Ramię / Barki", primaryUnit: " cm", primaryColor: "#a855f7", decimals: 1, goodWhenUp: true, icon: <Ruler className="h-4 w-4" /> },
];

const parseNoteValue = (notes: string | null, label: string): number | null => {
  if (!notes) return null;
  const match = notes.match(new RegExp(`${label}:\\s*([0-9.]+)`));
  return match ? parseFloat(match[1]) : null;
};

// ─── Health Norms Definition ───────────────────────────────────────────────────

interface NormDef {
  key: string;
  label: string;
  unit: string;
  minM: number; maxM: number;
  minF: number; maxF: number;
}

interface NormGroup {
  title: string;
  icon: React.ReactNode;
  norms: NormDef[];
}

const NORM_GROUPS: NormGroup[] = [
  {
    title: "Podstawowe",
    icon: <Scale className="h-3.5 w-3.5" />,
    norms: [
      { key: "weight", label: "Waga", unit: "kg", minM: 60, maxM: 85, minF: 50, maxF: 70 },
      { key: "bmi", label: "BMI", unit: "", minM: 18.5, maxM: 24.9, minF: 18.5, maxF: 24.9 },
    ],
  },
  {
    title: "Tłuszcz",
    icon: <Activity className="h-3.5 w-3.5" />,
    norms: [
      { key: "bodyFat", label: "Tłuszcz (%)", unit: "%", minM: 10, maxM: 20, minF: 18, maxF: 28 },
      { key: "fatMass", label: "Masa tłuszczu", unit: "kg", minM: 7, maxM: 17, minF: 10, maxF: 20 },
      { key: "visceralFat", label: "Tłuszcz trzewny", unit: "index", minM: 1, maxM: 9, minF: 1, maxF: 9 },
    ],
  },
  {
    title: "Mięśnie",
    icon: <Dumbbell className="h-3.5 w-3.5" />,
    norms: [
      { key: "muscleMass", label: "Masa mięśniowa", unit: "kg", minM: 35, maxM: 55, minF: 25, maxF: 40 },
      { key: "skeletalMuscleMass", label: "Mięśnie szkieletowe", unit: "kg", minM: 25, maxM: 40, minF: 15, maxF: 25 },
      { key: "musclePct", label: "Procent mięśni", unit: "%", minM: 70, maxM: 85, minF: 60, maxF: 75 },
    ],
  },
  {
    title: "Woda i białko",
    icon: <Droplet className="h-3.5 w-3.5" />,
    norms: [
      { key: "bodyWaterPct", label: "Woda (%)", unit: "%", minM: 50, maxM: 65, minF: 45, maxF: 60 },
      { key: "waterMass", label: "Masa wody", unit: "kg", minM: 35, maxM: 50, minF: 25, maxF: 40 },
      { key: "proteinPct", label: "Białko (%)", unit: "%", minM: 16, maxM: 22, minF: 14, maxF: 20 },
      { key: "proteinMass", label: "Masa białka", unit: "kg", minM: 10, maxM: 18, minF: 8, maxF: 14 },
    ],
  },
  {
    title: "Kości",
    icon: <Award className="h-3.5 w-3.5" />,
    norms: [
      { key: "boneMass", label: "Masa kości", unit: "kg", minM: 2.5, maxM: 4.0, minF: 2.0, maxF: 3.5 },
      { key: "bonePct", label: "Procent kości", unit: "%", minM: 3, maxM: 5, minF: 3, maxF: 5 },
      { key: "leanBodyMass", label: "Masa beztłuszczowa", unit: "kg", minM: 50, maxM: 70, minF: 35, maxF: 55 },
    ],
  },
  {
    title: "Metabolizm",
    icon: <Flame className="h-3.5 w-3.5" />,
    norms: [
      { key: "basalMetabolism", label: "BMR", unit: "kcal", minM: 1400, maxM: 1900, minF: 1100, maxF: 1500 },
      { key: "metabolicAge", label: "Wiek metaboliczny", unit: "lat", minM: 18, maxM: 35, minF: 18, maxF: 35 },
      { key: "bodyScore", label: "Body Score", unit: "/100", minM: 70, maxM: 100, minF: 70, maxF: 100 },
    ],
  },
  {
    title: "Proporcje",
    icon: <Ruler className="h-3.5 w-3.5" />,
    norms: [
      { key: "waistToHipRatio", label: "WHR", unit: "", minM: 0.4, maxM: 0.85, minF: 0.4, maxF: 0.80 },
      { key: "idealWeight", label: "Waga idealna", unit: "kg", minM: 60, maxM: 85, minF: 50, maxF: 70 },
    ],
  },
];

// ─── Body Type Color Map ───────────────────────────────────────────────────────

function getBodyTypeBadgeClass(bodyType: string): string {
  const lower = bodyType.toLowerCase();
  if (lower.includes("sportow")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (lower.includes("sprawn")) return "bg-lime-500/20 text-lime-400 border-lime-500/30";
  if (lower.includes("idealn")) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  if (lower.includes("mocn")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (lower.includes("szczup")) return "bg-sky-500/20 text-sky-400 border-sky-500/30";
  return "bg-[#2e3229] text-[#8c9282] border-[#2e3229]";
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BodyClient({
  initialMeasurements,
  userSex,
}: BodyClientProps) {
  const [subTab, setSubTab] = useState<"composition" | "circumferences">("composition");
  const [timeRange, setTimeRange] = useState<"1M" | "3M" | "6M" | "1R" | "ALL">("1R");
  const [measurementModalOpen, setMeasurementModalOpen] = useState(false);
  const [bodyTypeHistoryOpen, setBodyTypeHistoryOpen] = useState(false);

  // Pomiary state
  const [measurements, setMeasurements] = useState(() => {
    return initialMeasurements.map((m: any) => ({
      ...m,
      thigh: m.thigh ?? parseNoteValue(m.notes, "Udo"),
      bicep: m.bicep ?? parseNoteValue(m.notes, "Biceps"),
      calf: m.calf ?? parseNoteValue(m.notes, "Łydka"),
      shoulder: m.shoulder ?? parseNoteValue(m.notes, "Ramię"),
    }));
  });

  const isMale = userSex !== "F";
  const latestSmartScale = measurements.find((m: any) => m.weight !== null) ?? null;
  const latestCircumference = measurements.find(
    (m: any) => m.waist != null || m.chest != null || m.hips != null || m.thigh != null || m.bicep != null || m.calf != null || m.shoulder != null
  ) ?? null;

  // ── Filtered measurements by time range ──────────────────────────────────────

  const getFilteredMeasurements = () => {
    const now = new Date();
    let limitDate = subDays(now, 180);
    if (timeRange === "1M") limitDate = subDays(now, 30);
    else if (timeRange === "3M") limitDate = subDays(now, 90);
    else if (timeRange === "1R") limitDate = subDays(now, 365);
    else if (timeRange === "ALL") return measurements;

    return measurements.filter((m: any) => isAfter(new Date(m.date), limitDate));
  };

  const filteredMeasurements = getFilteredMeasurements();
  const filteredSmartScaleMeasurements = filteredMeasurements.filter((m: any) => m.weight !== null);
  const filteredCircumferenceMeasurements = filteredMeasurements.filter(
    (m: any) => m.waist != null || m.chest != null || m.hips != null || m.thigh != null || m.bicep != null || m.calf != null || m.shoulder != null
  );

  const mapMeasurement = (m: any): BodyTimelinePoint => ({
    date: new Date(m.date),
    dateStr: format(new Date(m.date), "yyyy-MM-dd"),
    weight: m.weight,
    bmi: m.bmi,
    bodyFat: m.bodyFat,
    muscleMass: m.muscleMass,
    bodyWaterPct: m.bodyWaterPct,
    visceralFat: m.visceralFat,
    boneMass: m.boneMass,
  });

  const filteredPoints = filteredSmartScaleMeasurements.map(mapMeasurement).reverse();

  // ── Circumference deltas ─────────────────────────────────────────────────────

  const getCircumferenceDelta = () => {
    const measurementsWithCirc = measurements.filter(
      (m: any) => m.waist != null || m.chest != null || m.hips != null || m.thigh != null || m.bicep != null || m.calf != null || m.shoulder != null
    );
    if (measurementsWithCirc.length < 2) {
      return {
        waist: 0, chest: 0, hips: 0, thigh: 0, bicep: 0, calf: 0, shoulder: 0,
        latestDate: null, prevDate: null
      };
    }
    const latestWithCirc = measurementsWithCirc[0];
    const prevWithCirc = measurementsWithCirc[1];
    return {
      waist: latestWithCirc.waist && prevWithCirc.waist ? latestWithCirc.waist - prevWithCirc.waist : 0,
      chest: latestWithCirc.chest && prevWithCirc.chest ? latestWithCirc.chest - prevWithCirc.chest : 0,
      hips: latestWithCirc.hips && prevWithCirc.hips ? latestWithCirc.hips - prevWithCirc.hips : 0,
      thigh: latestWithCirc.thigh && prevWithCirc.thigh ? latestWithCirc.thigh - prevWithCirc.thigh : 0,
      bicep: latestWithCirc.bicep && prevWithCirc.bicep ? latestWithCirc.bicep - prevWithCirc.bicep : 0,
      calf: latestWithCirc.calf && prevWithCirc.calf ? latestWithCirc.calf - prevWithCirc.calf : 0,
      shoulder: latestWithCirc.shoulder && prevWithCirc.shoulder ? latestWithCirc.shoulder - prevWithCirc.shoulder : 0,
      latestDate: latestWithCirc.date,
      prevDate: prevWithCirc.date,
    };
  };

  const circDelta = getCircumferenceDelta();

  // ── Render: Norm Bar ─────────────────────────────────────────────────────────

  const renderNormBar = (norm: NormDef) => {
    const val = latestSmartScale?.[norm.key];
    if (val == null) return null;

    const min = isMale ? norm.minM : norm.minF;
    const max = isMale ? norm.maxM : norm.maxF;
    const range = max - min;
    const padding = range * 0.5;
    const scaleMin = min - padding;
    const scaleMax = max + padding;
    const percent = Math.min(Math.max(((val - scaleMin) / (scaleMax - scaleMin)) * 100, 3), 97);
    const isNormal = val >= min && val <= max;

    // Norm zone position (percentage)
    const normStart = ((min - scaleMin) / (scaleMax - scaleMin)) * 100;
    const normWidth = ((max - min) / (scaleMax - scaleMin)) * 100;

    return (
      <div key={norm.key} className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-[#f1f2ec]">{norm.label}</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#5d6050] font-mono">
              {min}–{max} {norm.unit}
            </span>
            <span className="font-mono font-bold flex items-center gap-1.5">
              {typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val}
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${isNormal ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400"}`}>
                {isNormal ? "Norma" : "Poza"}
              </span>
            </span>
          </div>
        </div>

        <div className="relative h-1.5 bg-[#0d0e0c] rounded-full border border-[#2e3229]">
          {/* Norm zone highlight */}
          <div
            className="absolute h-full rounded-full bg-emerald-500/15"
            style={{ left: `${normStart}%`, width: `${normWidth}%` }}
          />
          {/* Value dot */}
          <div
            className={`absolute w-2.5 h-2.5 rounded-full -top-[2px] -translate-x-1/2 border-2 border-[#0d0e0c] shadow-md ${
              isNormal ? "bg-[#bce663]" : "bg-orange-500"
            }`}
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  // ── Time Range Selector ──────────────────────────────────────────────────────

  const TimeRangeSelector = () => (
    <div className="flex bg-[#0d0e0c] p-0.5 rounded-lg border border-[#2e3229]">
      {(["1M", "3M", "6M", "1R", "ALL"] as const).map((r) => (
        <button
          key={r}
          onClick={() => setTimeRange(r)}
          className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${
            timeRange === r ? "bg-[#bce663] text-[#0d0e0c]" : "text-[#8c9282]"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* NAGŁÓWEK */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2e3229] pb-5">
        <div>
          <p className="text-[10px] font-mono text-[#5d6050] mb-1">HealthOS / Ciało</p>
          <h1 className="text-2xl font-bold tracking-tight text-[#f1f2ec]">Ciało</h1>
          <p className="text-sm text-[#8c9282] mt-1">
            Kompozycja ciała oraz obwody.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMeasurementModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all"
          >
            <Plus className="h-4 w-4" />
            Dodaj pomiar
          </button>
        </div>
      </div>

      <div className="space-y-6">
          {/* Sub-tab switcher */}
          <div className="flex bg-[#1a1c18] p-1 rounded-xl border border-[#2e3229] max-w-xs">
            <button
              onClick={() => setSubTab("composition")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                subTab === "composition"
                  ? "bg-[#bce663] text-[#0d0e0c]"
                  : "text-[#8c9282] hover:text-[#f1f2ec]"
              }`}
            >
              Kompozycja Ciała
            </button>
            <button
              onClick={() => setSubTab("circumferences")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                subTab === "circumferences"
                  ? "bg-[#bce663] text-[#0d0e0c]"
                  : "text-[#8c9282] hover:text-[#f1f2ec]"
              }`}
            >
              Obwody Ciała
            </button>
          </div>

          {subTab === "composition" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ── Left 2 cols: Charts ── */}
              <div className="lg:col-span-2 space-y-6">
                {/* Główny Trend Kompozycji */}
                <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl overflow-hidden">
                  <CardHeader className="flex flex-row justify-between items-center pb-2">
                    <div>
                      <CardTitle className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-[#bce663]" /> Trend Kompozycji Ciała
                      </CardTitle>
                      <CardDescription className="text-xs text-[#8c9282]">
                        Waga, tłuszcz oraz masa mięśniowa na jednym wykresie.
                      </CardDescription>
                    </div>
                    <TimeRangeSelector />
                  </CardHeader>
                  <CardContent>
                    <CombinedBodyChart data={filteredPoints} />
                  </CardContent>
                </Card>

                {/* ── Szczegółowa Kompozycja: Wykresy Trendów ── */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                        <Scale className="h-5 w-5 text-[#bce663]" /> Szczegółowa Kompozycja Ciała
                      </h2>
                      <p className="text-xs text-[#8c9282] mt-0.5">
                        Trendy poszczególnych wskaźników z inteligentnej wagi.
                      </p>
                    </div>
                    {latestSmartScale?.bodyScore != null && (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-[#8c9282] uppercase tracking-wider">Ocena ogólna</span>
                        <span className="text-xl font-bold text-[#bce663]">{latestSmartScale.bodyScore}/100</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TREND_CHARTS.map((chart) => (
                      <ParameterTrendChart
                        key={chart.primaryKey}
                        measurements={filteredSmartScaleMeasurements}
                        primaryKey={chart.primaryKey}
                        primaryLabel={chart.primaryLabel}
                        primaryUnit={chart.primaryUnit}
                        primaryColor={chart.primaryColor}
                        decimals={chart.decimals}
                        goodWhenUp={chart.goodWhenUp}
                        secondaryKey={chart.secondaryKey}
                        secondaryLabel={chart.secondaryLabel}
                        secondaryUnit={chart.secondaryUnit}
                        secondaryColor={chart.secondaryColor}
                        secondaryDecimals={chart.secondaryDecimals}
                        secondaryGoodWhenUp={chart.secondaryGoodWhenUp}
                        icon={chart.icon}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Typ Sylwetki ── */}
                {latestSmartScale?.bodyType && (
                  <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#bce663]">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] text-[#8c9282] uppercase tracking-wider font-semibold">Typ sylwetki</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-lg font-bold text-[#f1f2ec]">{latestSmartScale.bodyType}</span>
                              <Badge className={`text-[10px] font-bold border ${getBodyTypeBadgeClass(latestSmartScale.bodyType)}`}>
                                Aktualny
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBodyTypeHistoryOpen(true)}
                          className="bg-[#0d0e0c] border-[#2e3229] text-[#8c9282] hover:text-[#f1f2ec] hover:border-[#bce663]/40 text-xs gap-1.5"
                        >
                          <History className="h-3.5 w-3.5" />
                          Historia
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* ── Right col: Paski Norm Zdrowotnych ── */}
              <div className="space-y-6">
                <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                      <Scale className="h-5 w-5 text-[#bce663]" /> Paski Norm Zdrowotnych
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8c9282]">
                      Twoje ostatnie wskaźniki na tle zalecanych norm ({isMale ? "M" : "K"}).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {NORM_GROUPS.map((group) => {
                      // Only render groups that have at least one value
                      const hasValues = group.norms.some((n) => latestSmartScale?.[n.key] != null);
                      if (!hasValues) return null;

                      return (
                        <div key={group.title} className="space-y-3">
                          <h3 className="text-[10px] font-bold text-[#bce663] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#2e3229] pb-1.5">
                            {group.icon} {group.title}
                          </h3>
                          <div className="space-y-3">
                            {group.norms.map((norm) => renderNormBar(norm))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Obwody Ciała i Porównanie ── */}
              <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl">
                <CardHeader className="flex flex-row justify-between items-center pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                      <Ruler className="h-5 w-5 text-[#bce663]" /> Obwody Ciała i Porównanie
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8c9282]">
                      Śledzenie wymiarów sylwetki oraz analiza zmian w czasie.
                    </CardDescription>
                  </div>
                  <TimeRangeSelector />
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Grid 7 obwodów */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {CIRCUMFERENCE_CHARTS.map((circ) => {
                      const val = latestCircumference?.[circ.primaryKey];
                      const deltaVal = circDelta[circ.primaryKey as keyof typeof circDelta];
                      const goodWhenUp = circ.goodWhenUp ?? false;
                      const hasDelta = typeof deltaVal === "number" && deltaVal !== 0;

                      return (
                        <div key={circ.primaryKey} className="bg-[#0d0e0c] border border-[#2e3229] p-3 rounded-xl flex flex-col justify-between min-h-[100px]">
                          <div>
                            <div className="flex items-center gap-1.5 text-[#8c9282]">
                              <span className="text-[#bce663] shrink-0">{circ.icon}</span>
                              <span className="text-[10px] uppercase font-bold tracking-wider leading-none">{circ.primaryLabel}</span>
                            </div>
                            <p className="text-xl font-mono font-bold text-[#f1f2ec] mt-2">
                              {val ? `${val} cm` : "—"}
                            </p>
                          </div>
                          {hasDelta && (
                            <div className="mt-2 text-left">
                              {(() => {
                                const isGood = goodWhenUp ? deltaVal > 0 : deltaVal < 0;
                                const formatted = deltaVal > 0 ? `+${deltaVal.toFixed(1)}` : deltaVal.toFixed(1);
                                return (
                                  <Badge className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                                    isGood ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                  }`}>
                                    {formatted} cm
                                  </Badge>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {circDelta.latestDate && circDelta.prevDate && (
                    <div className="text-xs text-[#8c9282] flex items-center gap-1.5 bg-[#0d0e0c] p-2.5 rounded-lg border border-[#2e3229] max-w-max">
                      <Info className="h-3.5 w-3.5 text-[#bce663]" />
                      Porównanie pomiaru z dnia {format(new Date(circDelta.latestDate), "d MMM yyyy", { locale: pl })} do pomiaru z dnia {format(new Date(circDelta.prevDate), "d MMM yyyy", { locale: pl })}.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Grid Wykresów Obwodów Ciała ── */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#f1f2ec] flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#bce663]" /> Historia Zmian Obwodów
                  </h2>
                  <p className="text-xs text-[#8c9282] mt-0.5">
                    Wykresy pokazujące jak Twoje obwody zmieniały się na przestrzeni czasu.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {CIRCUMFERENCE_CHARTS.map((chart) => (
                    <ParameterTrendChart
                      key={chart.primaryKey}
                      measurements={filteredCircumferenceMeasurements}
                      primaryKey={chart.primaryKey}
                      primaryLabel={chart.primaryLabel}
                      primaryUnit={chart.primaryUnit}
                      primaryColor={chart.primaryColor}
                      decimals={chart.decimals}
                      goodWhenUp={chart.goodWhenUp}
                      icon={chart.icon}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      {/* ════════ MODAL: Body Type History ════════ */}
      {bodyTypeHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setBodyTypeHistoryOpen(false)}>
          <div
            className="bg-[#1a1c18] border border-[#2e3229] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#2e3229]">
              <div>
                <h2 className="text-lg font-bold text-[#f1f2ec]">Historia typu sylwetki</h2>
                <p className="text-xs text-[#8c9282] mt-0.5">
                  Pełna historia oznaczenia sylwetki przez wagę Xiaomi · {measurements.filter((m: any) => m.bodyType).length} pomiarów
                </p>
              </div>
              <button
                onClick={() => setBodyTypeHistoryOpen(false)}
                className="p-2 rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#8c9282] hover:text-[#f1f2ec] hover:border-[#bce663]/40 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="sticky top-0 bg-[#1a1c18]">
                  <tr className="border-b border-[#2e3229]">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-[#5d6050] uppercase tracking-wider">Data</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-[#5d6050] uppercase tracking-wider">Typ</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-[#5d6050] uppercase tracking-wider">Waga</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-[#5d6050] uppercase tracking-wider">% tł.</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-[#5d6050] uppercase tracking-wider">% mięśni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2e3229]/50">
                  {measurements
                    .filter((m: any) => m.bodyType)
                    .map((m: any) => (
                      <tr key={m.id} className="hover:bg-[#2e3229]/20 transition-colors">
                        <td className="px-5 py-3 text-xs font-mono text-[#8c9282]">
                          {format(new Date(m.date), "dd MMM yyyy", { locale: pl })}
                        </td>
                        <td className="px-5 py-3">
                          <Badge className={`text-[10px] font-bold border ${getBodyTypeBadgeClass(m.bodyType)}`}>
                            {m.bodyType}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-[#f1f2ec] text-right">
                          {m.weight ? `${m.weight} kg` : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-[#f1f2ec] text-right">
                          {m.bodyFat != null ? `${m.bodyFat}%` : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-[#f1f2ec] text-right">
                          {m.musclePct != null ? `${m.musclePct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal pomiaru */}
      <BodyMeasurementModal
        isOpen={measurementModalOpen}
        onClose={() => setMeasurementModalOpen(false)}
        onSaved={() => { setMeasurementModalOpen(false); window.location.reload(); }}
      />
    </div>
  );
}

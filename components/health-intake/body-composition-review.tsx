"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface BodyCompositionPayload {
  measuredAt?: string | null;
  sourceLabel?: string | null;
  weight: number | null;
  bmi: number | null;
  bodyFat: number | null;
  leanBodyMass: number | null;
  muscleMass: number | null;
  boneMass: number | null;
  bodyWaterPct: number | null;
  proteinPct: number | null;
  visceralFat: number | null;
  basalMetabolism: number | null;
  metabolicAge: number | null;
  bodyType: string | null;
  bodyScore: number | null;
  idealWeight: number | null;
  skeletalMusclePct: number | null;
  // Nowe wskaźniki
  waterMass: number | null;
  fatMass: number | null;
  proteinMass: number | null;
  musclePct: number | null;
  bonePct: number | null;
  skeletalMuscleMass: number | null;
  waistToHipRatio: number | null;
}

export interface BodyCompositionReviewFormProps {
  intakeId: string;
  defaultDate?: string;
  extracted: Record<string, unknown>;
  sourceLabel: string | null;
  documentDate: string | null;
  onSaved: (info: { targetId: string; targetUrl?: string }) => void;
  onReclassify: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function asNumString(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return String(n);
  }
  return "";
}
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseNum(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

interface FieldDef {
  key: keyof Omit<BodyCompositionPayload, "measuredAt" | "sourceLabel" | "bodyType">;
  label: string;
  unit: string;
  step?: string;
}

// Order matters — most "important" first.
const FIELDS: FieldDef[] = [
  { key: "weight", label: "Waga", unit: "kg", step: "0.1" },
  { key: "bmi", label: "BMI", unit: "", step: "0.1" },
  { key: "bodyFat", label: "Tłuszcz", unit: "%", step: "0.1" },
  { key: "muscleMass", label: "Masa mięśniowa", unit: "kg", step: "0.1" },
  { key: "leanBodyMass", label: "Masa beztłuszczowa", unit: "kg", step: "0.1" },
  { key: "boneMass", label: "Masa kości", unit: "kg", step: "0.1" },
  { key: "bodyWaterPct", label: "Woda", unit: "%", step: "0.1" },
  { key: "proteinPct", label: "Białko", unit: "%", step: "0.1" },
  { key: "visceralFat", label: "Tłuszcz trzewny", unit: "idx", step: "1" },
  { key: "basalMetabolism", label: "BMR", unit: "kcal", step: "1" },
  { key: "metabolicAge", label: "Wiek metab.", unit: "lat", step: "1" },
  { key: "bodyScore", label: "Body score", unit: "/100", step: "1" },
  { key: "idealWeight", label: "Idealna waga", unit: "kg", step: "0.1" },
  { key: "skeletalMusclePct", label: "Mięśnie szkieletowe", unit: "%", step: "0.1" },
  // Nowe wskaźniki
  { key: "waterMass", label: "Masa wody", unit: "kg", step: "0.1" },
  { key: "fatMass", label: "Masa tłuszczu", unit: "kg", step: "0.1" },
  { key: "proteinMass", label: "Masa białka", unit: "kg", step: "0.1" },
  { key: "musclePct", label: "Procent mięśni", unit: "%", step: "0.1" },
  { key: "bonePct", label: "Procent kości", unit: "%", step: "0.1" },
  { key: "skeletalMuscleMass", label: "Masa mięśni szkielet.", unit: "kg", step: "0.1" },
  { key: "waistToHipRatio", label: "WHR", unit: "", step: "0.01" },
];

export function BodyCompositionReviewForm({
  intakeId,
  defaultDate,
  extracted,
  sourceLabel,
  documentDate,
  onSaved,
  onReclassify,
}: BodyCompositionReviewFormProps) {
  // Initial form state from extracted JSON.
  const initial = useMemo(() => {
    const e = extracted as unknown as Partial<BodyCompositionPayload>;
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      init[f.key] = asNumString(e[f.key]);
    }
    return {
      values: init,
      bodyType: asString(e.bodyType),
      sourceLabel: asString(e.sourceLabel) || sourceLabel || "",
      measuredAt: asString(e.measuredAt),
      date: documentDate || defaultDate || todayIso(),
    };
  }, [extracted, sourceLabel, documentDate, defaultDate]);

  const [values, setValues] = useState<Record<string, string>>(initial.values);
  const [bodyType, setBodyType] = useState(initial.bodyType);
  const [srcLabel, setSrcLabel] = useState(initial.sourceLabel);
  const [date, setDate] = useState(initial.date);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Detect AI-detected fields (vs. blank)
  function isAiFilled(key: string): boolean {
    return initial.values[key] !== "" || (key === "bodyType" && initial.bodyType !== "");
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        date,
        sourceLabel: srcLabel || null,
        measuredAt: initial.measuredAt || null,
        bodyType: bodyType || null,
        notes: notes || null,
      };
      for (const f of FIELDS) {
        payload[f.key] = parseNum(values[f.key]);
      }

      const res = await fetch(`/api/intake/${intakeId}/save-body`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved({ targetId: data.measurementId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 p-3 rounded-md border border-border bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Sprawdź dane przed zapisem
        </h3>
        <Button size="sm" variant="ghost" type="button" onClick={onReclassify}>
          Analizuj ponownie
        </Button>
      </div>

      {/* Top-row meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Data pomiaru
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Urządzenie / aplikacja
          </label>
          <input
            type="text"
            value={srcLabel}
            onChange={(e) => setSrcLabel(e.target.value)}
            placeholder="np. Xiaomi Body Scale S400"
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
      </div>

      {/* Numeric grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FIELDS.map((f) => {
          const ai = isAiFilled(f.key);
          return (
            <div key={f.key} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                {f.label}
                {ai && (
                  <span
                    title="Wartość rozpoznana przez AI"
                    className="text-[8px] text-primary/70"
                  >
                    AI
                  </span>
                )}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step={f.step ?? "any"}
                  value={values[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className={`w-full h-8 rounded-md border bg-background px-2 text-sm font-mono ${
                    ai ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                />
                <span className="text-[10px] text-muted-foreground w-10 shrink-0">{f.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Body type free text */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          Typ sylwetki
          {initial.bodyType && (
            <span className="text-[8px] text-primary/70">AI</span>
          )}
        </label>
        <input
          type="text"
          value={bodyType}
          onChange={(e) => setBodyType(e.target.value)}
          placeholder="np. balanced muscular, skinny fat"
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
        />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Notatki
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="opcjonalnie"
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Zapisuję…" : "Zapisz pomiar"}
        </Button>
      </div>
    </div>
  );
}

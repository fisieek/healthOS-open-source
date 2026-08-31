"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Save, Trash2, Edit2, X } from "lucide-react";

interface MeasurementValues {
  id: string;
  date: string; // ISO yyyy-MM-dd
  sourceLabel: string | null;
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
  height: number | null;
  notes: string | null;
  // Nowe wskaźniki
  waterMass: number | null;
  fatMass: number | null;
  proteinMass: number | null;
  musclePct: number | null;
  bonePct: number | null;
  skeletalMuscleMass: number | null;
  waistToHipRatio: number | null;
}

interface FieldDef {
  key: keyof Omit<MeasurementValues, "id" | "date" | "sourceLabel" | "bodyType" | "notes">;
  label: string;
  unit: string;
  step?: string;
}

const FIELDS: FieldDef[] = [
  { key: "weight", label: "Waga", unit: "kg", step: "0.1" },
  { key: "bmi", label: "BMI", unit: "", step: "0.1" },
  { key: "bodyFat", label: "Tłuszcz", unit: "%", step: "0.1" },
  { key: "muscleMass", label: "Mięśnie", unit: "kg", step: "0.1" },
  { key: "leanBodyMass", label: "Beztłuszczowa", unit: "kg", step: "0.1" },
  { key: "boneMass", label: "Kości", unit: "kg", step: "0.1" },
  { key: "bodyWaterPct", label: "Woda", unit: "%", step: "0.1" },
  { key: "proteinPct", label: "Białko", unit: "%", step: "0.1" },
  { key: "visceralFat", label: "Tłuszcz trzewny", unit: "idx", step: "1" },
  { key: "basalMetabolism", label: "BMR", unit: "kcal", step: "1" },
  { key: "metabolicAge", label: "Wiek metab.", unit: "lat", step: "1" },
  { key: "bodyScore", label: "Body score", unit: "/100", step: "1" },
  { key: "idealWeight", label: "Idealna waga", unit: "kg", step: "0.1" },
  { key: "skeletalMusclePct", label: "Mięśnie szkiel.", unit: "%", step: "0.1" },
  { key: "height", label: "Wzrost", unit: "cm", step: "0.5" },
  // Nowe wskaźniki
  { key: "waterMass", label: "Masa wody", unit: "kg", step: "0.1" },
  { key: "fatMass", label: "Masa tłuszczu", unit: "kg", step: "0.1" },
  { key: "proteinMass", label: "Masa białka", unit: "kg", step: "0.1" },
  { key: "musclePct", label: "Procent mięśni", unit: "%", step: "0.1" },
  { key: "bonePct", label: "Procent kości", unit: "%", step: "0.1" },
  { key: "skeletalMuscleMass", label: "Masa mięśni szkielet.", unit: "kg", step: "0.1" },
  { key: "waistToHipRatio", label: "WHR", unit: "", step: "0.01" },
];

function asString(v: number | null): string {
  return v != null ? String(v) : "";
}
function parseNum(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface BodyEditPanelProps {
  initial: MeasurementValues;
}

export function BodyEditPanel({ initial }: BodyEditPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [date, setDate] = useState(initial.date);
  const [srcLabel, setSrcLabel] = useState(initial.sourceLabel ?? "");
  const [bodyType, setBodyType] = useState(initial.bodyType ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of FIELDS) v[f.key] = asString(initial[f.key]);
    return v;
  });

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function cancelEdit() {
    setError(null);
    setDate(initial.date);
    setSrcLabel(initial.sourceLabel ?? "");
    setBodyType(initial.bodyType ?? "");
    setNotes(initial.notes ?? "");
    const v: Record<string, string> = {};
    for (const f of FIELDS) v[f.key] = asString(initial[f.key]);
    setValues(v);
    setEditing(false);
  }

  async function save() {
    setError(null);
    const payload: Record<string, unknown> = {
      date,
      sourceLabel: srcLabel || null,
      bodyType: bodyType || null,
      notes: notes || null,
    };
    for (const f of FIELDS) payload[f.key] = parseNum(values[f.key]);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/health/body/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  async function destroy() {
    if (!confirm("Usunąć ten pomiar? Tej akcji nie można cofnąć.")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/health/body/${initial.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        router.push("/health/body");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Edit2 className="h-3.5 w-3.5 mr-1.5" />
          Edytuj
        </Button>
        <Button size="sm" variant="ghost" onClick={destroy} disabled={pending}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Usuń
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-md border border-border bg-muted/20">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
        Edycja pomiaru
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</label>
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
            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {f.label}
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step={f.step ?? "any"}
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm font-mono"
              />
              <span className="text-[10px] text-muted-foreground w-10 shrink-0">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Typ sylwetki
        </label>
        <input
          type="text"
          value={bodyType}
          onChange={(e) => setBodyType(e.target.value)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Notatki</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {pending ? "Zapisuję…" : "Zapisz"}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={pending}>
          <X className="h-3.5 w-3.5 mr-1.5" />
          Anuluj
        </Button>
      </div>
    </div>
  );
}

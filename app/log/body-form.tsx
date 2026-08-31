"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  date: string;
  latestWeight: number | null;
}

function Field({
  label,
  name,
  value,
  unit,
  placeholder,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  unit: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={name}
          type="number"
          step="0.1"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground w-8 shrink-0">{unit}</span>
      </div>
    </div>
  );
}

export function BodyForm({ date, latestWeight }: Props) {
  const router = useRouter();
  const [weight, setWeight] = useState(latestWeight?.toFixed(1) ?? "");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weight && !bodyFat && !muscleMass && !waist && !chest && !hips) {
      setResult("✗ Wpisz przynajmniej jedną wartość");
      setTimeout(() => setResult(null), 3000);
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/log/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, weight, bodyFat, muscleMass, waist, chest, hips, notes }),
      });
      if (res.ok) {
        setResult("✓ Zapisano");
        router.refresh();
      } else {
        const d = await res.json();
        setResult(`✗ ${d.error}`);
      }
    } catch {
      setResult("✗ Błąd połączenia");
    } finally {
      setSaving(false);
      setTimeout(() => setResult(null), 4000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Waga" name="weight" value={weight} unit="kg" placeholder="75.0" onChange={setWeight} />
        <Field label="Tłuszcz" name="bodyFat" value={bodyFat} unit="%" placeholder="20.0" onChange={setBodyFat} />
        <Field label="Mięśnie" name="muscleMass" value={muscleMass} unit="kg" placeholder="35.0" onChange={setMuscleMass} />
        <Field label="Talia" name="waist" value={waist} unit="cm" placeholder="80" onChange={setWaist} />
        <Field label="Klatka" name="chest" value={chest} unit="cm" placeholder="100" onChange={setChest} />
        <Field label="Biodra" name="hips" value={hips} unit="cm" placeholder="95" onChange={setHips} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notatki</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcjonalnie"
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Zapisuję…" : "Zapisz"}
        </Button>
        {result && <span className="text-xs text-muted-foreground">{result}</span>}
      </div>
    </form>
  );
}

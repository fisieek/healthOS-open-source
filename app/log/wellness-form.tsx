"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  initial: {
    energyScore: number | null;
    moodScore: number | null;
    stressScore: number | null;
    notes: string | null;
  } | null;
  date: string;
}

function ScoreSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className={`text-lg font-bold ${color}`}>{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1</span>
        <span>10</span>
      </div>
    </div>
  );
}

export function WellnessForm({ initial, date }: Props) {
  const router = useRouter();
  const [energy, setEnergy] = useState(initial?.energyScore ?? 7);
  const [mood, setMood] = useState(initial?.moodScore ?? 7);
  const [stress, setStress] = useState(initial?.stressScore ?? 3);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/log/wellness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, energyScore: energy, moodScore: mood, stressScore: stress, notes: notes || null }),
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <ScoreSlider label="Energia" value={energy} onChange={setEnergy} color="text-yellow-500" />
      <ScoreSlider label="Nastrój" value={mood} onChange={setMood} color="text-blue-500" />
      <ScoreSlider label="Stres" value={stress} onChange={setStress} color="text-red-500" />
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notatki</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Jak się czujesz? (opcjonalnie)"
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
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

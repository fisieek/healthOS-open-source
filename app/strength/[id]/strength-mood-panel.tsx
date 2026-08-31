"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

export interface StrengthMoodPanelProps {
  workoutId: string;
  initialMood: number | null;
  initialNote: string | null;
}

export function StrengthMoodPanel({
  workoutId,
  initialMood,
  initialNote,
}: StrengthMoodPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(initialMood);
  const [note, setNote] = useState(initialNote ?? "");

  function persist(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/strength/${workoutId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function pickMood(value: number) {
    const next = value === mood ? null : value;
    setMood(next);
    persist({ moodScore: next });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
            Jak się czułem (1–5)
          </h3>
          {mood && (
            <button
              type="button"
              onClick={() => pickMood(mood)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              wyczyść
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pickMood(n)}
              disabled={pending}
              className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                mood && n <= mood
                  ? "border-yellow-500 bg-yellow-500/10"
                  : "border-border bg-card hover:bg-accent"
              }`}
              title={`${n}/5`}
            >
              <Star
                className={`h-5 w-5 ${
                  mood && n <= mood ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => persist({ moodNote: note || null })}
          placeholder="Notatka — co pompowało, co zostawiło ślad…"
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

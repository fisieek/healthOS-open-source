"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Star, RotateCcw } from "lucide-react";
import type { IntensityClass } from "@/app/generated/prisma/client";

const INTENSITY_OPTIONS: { value: IntensityClass; label: string }[] = [
  { value: "RECOVERY", label: "Recovery" },
  { value: "EASY", label: "Easy" },
  { value: "STEADY", label: "Steady" },
  { value: "TEMPO", label: "Tempo" },
  { value: "THRESHOLD", label: "Threshold" },
  { value: "INTERVAL", label: "Interval" },
  { value: "LONG", label: "Long" },
  { value: "RACE", label: "Race" },
  { value: "OTHER", label: "Inne" },
];

export interface ActivityEditPanelProps {
  activityId: string;
  initialMood: number | null;
  initialMoodNote: string | null;
  initialIntensity: IntensityClass | null;
  initialOverride: boolean;
  type: "RUN" | "RIDE" | "SWIM" | "STRENGTH" | "OTHER";
}

export function ActivityEditPanel({
  activityId,
  initialMood,
  initialMoodNote,
  initialIntensity,
  initialOverride,
  type,
}: ActivityEditPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mood, setMood] = useState<number | null>(initialMood);
  const [moodNote, setMoodNote] = useState(initialMoodNote ?? "");
  const [intensity, setIntensity] = useState<IntensityClass | null>(initialIntensity);
  const [override, setOverride] = useState(initialOverride);

  function persist(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/activities/${activityId}`, {
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

  function saveMoodNote() {
    persist({ moodNote: moodNote || null });
  }

  function pickIntensity(value: IntensityClass) {
    setIntensity(value);
    setOverride(true);
    persist({ intensityClass: value, intensityClassOverride: true });
  }

  function clearIntensityOverride() {
    setOverride(false);
    persist({ intensityClass: null, intensityClassOverride: false });
  }

  return (
    <div className="space-y-4">
      {/* Mood */}
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
              className={`group flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
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
          value={moodNote}
          onChange={(e) => setMoodNote(e.target.value)}
          onBlur={saveMoodNote}
          placeholder="Krótka notatka — co działało, co bolało, jak nogi…"
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-y"
        />
      </div>

      {/* Intensity (skip for STRENGTH/OTHER) */}
      {type !== "STRENGTH" && type !== "OTHER" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wide">
              Klasa intensywności
            </h3>
            <span className="text-[10px] text-muted-foreground">
              {override ? "🔒 ręcznie" : "🤖 auto"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {INTENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => pickIntensity(opt.value)}
                disabled={pending}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  intensity === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {override && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearIntensityOverride}
              disabled={pending}
            >
              <RotateCcw className="h-3 w-3 mr-1.5" />
              Wróć do auto-klasyfikacji
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

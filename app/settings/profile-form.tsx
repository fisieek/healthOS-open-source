"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { computeZones } from "@/lib/services/zones";
import type { HrZoneMethod } from "@/app/generated/prisma/client";

export interface ProfileFormProps {
  initial: {
    birthDate: string | null;
    sex: string | null;
    heightCm: number | null;
    maxHr: number | null;
    restingHr: number | null;
    lthr: number | null;
    ftp: number | null;
    thresholdPace: number | null;
    zonesMethod: HrZoneMethod;
    weeklyRunningTargetKm?: number | null;
  } | null;
}

const ZONE_METHODS: { value: HrZoneMethod; label: string; hint: string }[] = [
  { value: "PERCENT_MAX", label: "% max HR", hint: "Najprostsza, wymaga tylko max HR" },
  { value: "PERCENT_LTHR", label: "% LTHR (Friel)", hint: "Dokładniejsza dla biegania, wymaga LTHR" },
  { value: "KARVONEN", label: "Karvonen", hint: "Karvonen: % HR rezerwy, wymaga maxHR i restHR" },
];

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [birthDate, setBirthDate] = useState(initial?.birthDate?.slice(0, 10) ?? "");
  const [sex, setSex] = useState(initial?.sex ?? "");
  const [heightCm, setHeightCm] = useState(initial?.heightCm?.toString() ?? "");
  const [maxHr, setMaxHr] = useState(initial?.maxHr?.toString() ?? "");
  const [restingHr, setRestingHr] = useState(initial?.restingHr?.toString() ?? "");
  const [lthr, setLthr] = useState(initial?.lthr?.toString() ?? "");
  const [ftp, setFtp] = useState(initial?.ftp?.toString() ?? "");
  const [zonesMethod, setZonesMethod] = useState<HrZoneMethod>(initial?.zonesMethod ?? "PERCENT_MAX");
  const [weeklyRunningTargetKm, setWeeklyRunningTargetKm] = useState(
    initial?.weeklyRunningTargetKm?.toString() ?? "45"
  );

  function parseNum(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    const payload = {
      birthDate: birthDate || null,
      sex: sex || null,
      heightCm: parseNum(heightCm),
      maxHr: parseNum(maxHr),
      restingHr: parseNum(restingHr),
      lthr: parseNum(lthr),
      ftp: parseNum(ftp),
      zonesMethod,
      weeklyRunningTargetKm: parseNum(weeklyRunningTargetKm),
    };

    startTransition(async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }

        // Przelicz strefy tętna dla wszystkich aktywności w tle
        fetch("/api/activities/recompute", { method: "POST" }).catch(() => {});

        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  // Live zones preview
  const zones = computeZones({
    method: zonesMethod,
    maxHr: parseNum(maxHr),
    restingHr: parseNum(restingHr),
    lthr: parseNum(lthr),
  });

  return (
    <div className="space-y-4">
      {/* Demographics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Data urodzenia">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Płeć">
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          >
            <option value="">—</option>
            <option value="M">Mężczyzna</option>
            <option value="F">Kobieta</option>
            <option value="X">Inna</option>
          </select>
        </Field>
        <Field label="Wzrost (cm)">
          <input
            type="number"
            inputMode="decimal"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="np. 180"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </Field>
      </div>

      {/* HR / threshold */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Max HR (bpm)" hint="Test maksymalny lub szac. 220-wiek">
          <input
            type="number"
            inputMode="numeric"
            value={maxHr}
            onChange={(e) => setMaxHr(e.target.value)}
            placeholder="np. 195"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </Field>
        <Field label="Tętno spocz." hint="rano w łóżku, średnia 7 dni">
          <input
            type="number"
            inputMode="numeric"
            value={restingHr}
            onChange={(e) => setRestingHr(e.target.value)}
            placeholder="np. 50"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </Field>
        <Field label="LTHR (bpm)" hint="próg mleczanowy">
          <input
            type="number"
            inputMode="numeric"
            value={lthr}
            onChange={(e) => setLthr(e.target.value)}
            placeholder="np. 175"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </Field>
        <Field label="FTP (W)" hint="rower, opcjonalnie">
          <input
            type="number"
            inputMode="numeric"
            value={ftp}
            onChange={(e) => setFtp(e.target.value)}
            placeholder="—"
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
          />
        </Field>
      </div>

      {/* Cele Treningowe */}
      <div className="border-t border-border/20 pt-4">
        <h3 className="text-xs font-semibold text-[#f1f2ec] uppercase tracking-wider mb-3">Cele Treningowe</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tygodniowy cel objętości biegu (km)" hint="Domyślnie 45 km, używany na wykresie objętości w zakładce Bieg">
            <input
              type="number"
              inputMode="numeric"
              value={weeklyRunningTargetKm}
              onChange={(e) => setWeeklyRunningTargetKm(e.target.value)}
              placeholder="np. 45"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono"
            />
          </Field>
        </div>
      </div>

      {/* Zone method */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Metoda obliczania stref</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ZONE_METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setZonesMethod(m.value)}
              className={`text-left p-3 rounded-md border text-sm transition-colors ${
                zonesMethod === m.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Live zones preview */}
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Podgląd stref</div>
        {zones ? (
          <div className="space-y-1.5">
            {zones.map((z) => (
              <div key={z.id} className="flex items-center gap-3 text-xs">
                <span
                  className={`w-1.5 h-4 rounded-sm ${
                    z.id === 1
                      ? "bg-blue-400"
                      : z.id === 2
                      ? "bg-green-400"
                      : z.id === 3
                      ? "bg-yellow-400"
                      : z.id === 4
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }`}
                />
                <span className="font-medium w-32 shrink-0">{z.label}</span>
                <span className="font-mono text-muted-foreground">
                  {z.low}–{z.high} bpm
                </span>
                <span className="text-muted-foreground hidden sm:inline">{z.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Uzupełnij {zonesMethod === "PERCENT_MAX" ? "max HR" : zonesMethod === "PERCENT_LTHR" ? "LTHR" : "max HR i restingHr"}, żeby zobaczyć strefy.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Zapisuję…" : "Zapisz profil"}
        </Button>
        {saved && <span className="text-xs text-green-600">✓ Zapisano</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

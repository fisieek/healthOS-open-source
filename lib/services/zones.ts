import type { HrZoneMethod } from "@/app/generated/prisma/client";

/**
 * HR zone definitions and helpers.
 *
 * Zones use the user's chosen method (PERCENT_MAX / PERCENT_LTHR / KARVONEN).
 * Each method produces 5 zones with bpm bounds [low, high] (high inclusive at last zone).
 *
 * Defaults follow widely used coaching schemes:
 *   - PERCENT_MAX: 50–60–70–80–90–100% of maxHR (Garmin/Polar default)
 *   - PERCENT_LTHR: 81/89/94/99/100% of LTHR (Joe Friel running zones, Z5 split into 5a/b/c is collapsed)
 *   - KARVONEN: 50–60–70–80–90% of HRR + restingHr
 */

export interface ZoneDef {
  id: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Lower bound (inclusive), bpm */
  low: number;
  /** Upper bound (exclusive for Z1-Z4, inclusive at Z5 = maxHR), bpm */
  high: number;
  description: string;
}

export interface ZoneInputs {
  method: HrZoneMethod;
  maxHr: number | null;
  restingHr: number | null;
  lthr: number | null;
}

const ZONE_LABELS: Record<1 | 2 | 3 | 4 | 5, { label: string; description: string }> = {
  1: { label: "Z1 — Recovery", description: "Bardzo lekko, regeneracja" },
  2: { label: "Z2 — Easy", description: "Trening tlenowy, baza" },
  3: { label: "Z3 — Steady", description: "Tempo umiarkowane" },
  4: { label: "Z4 — Threshold", description: "Próg mleczanowy" },
  5: { label: "Z5 — VO2max", description: "Maksimum, interwały" },
};

/**
 * Returns 5 HR zones in bpm. Returns null if required inputs are missing.
 */
export function computeZones(inputs: ZoneInputs): ZoneDef[] | null {
  const { method, maxHr, restingHr, lthr } = inputs;

  let bounds: [number, number, number, number, number, number] | null = null;

  if (method === "PERCENT_MAX") {
    if (!maxHr) return null;
    bounds = [
      Math.round(maxHr * 0.5),
      Math.round(maxHr * 0.6),
      Math.round(maxHr * 0.7),
      Math.round(maxHr * 0.8),
      Math.round(maxHr * 0.9),
      maxHr,
    ];
  } else if (method === "PERCENT_LTHR") {
    if (!lthr) return null;
    // Friel running zones (collapsed Z5): <85, 85-89, 90-94, 95-99, 100+
    bounds = [
      Math.round(lthr * 0.65),
      Math.round(lthr * 0.85),
      Math.round(lthr * 0.89),
      Math.round(lthr * 0.94),
      Math.round(lthr * 0.99),
      Math.max(maxHr ?? Math.round(lthr * 1.1), lthr + 5),
    ];
  } else if (method === "KARVONEN") {
    if (!maxHr || !restingHr) return null;
    const hrr = maxHr - restingHr;
    bounds = [
      Math.round(restingHr + hrr * 0.5),
      Math.round(restingHr + hrr * 0.6),
      Math.round(restingHr + hrr * 0.7),
      Math.round(restingHr + hrr * 0.8),
      Math.round(restingHr + hrr * 0.9),
      maxHr,
    ];
  }

  if (!bounds) return null;

  return [1, 2, 3, 4, 5].map((id) => ({
    id: id as 1 | 2 | 3 | 4 | 5,
    label: ZONE_LABELS[id as 1 | 2 | 3 | 4 | 5].label,
    description: ZONE_LABELS[id as 1 | 2 | 3 | 4 | 5].description,
    low: bounds![id - 1],
    high: bounds![id],
  }));
}

/**
 * Classify a single HR sample to its zone (1-5).
 * Below Z1 → returns 1 (anything alive); above Z5 → returns 5.
 */
export function zoneOf(bpm: number, zones: ZoneDef[]): 1 | 2 | 3 | 4 | 5 {
  for (const z of zones) {
    if (bpm < z.high) return z.id;
  }
  return 5;
}

/**
 * Compute time-in-zone (seconds) from heartrate + time streams.
 *
 * @param hrStream array of HR samples (bpm)
 * @param timeStream array of timestamps in seconds (same length as hrStream)
 * @param zones zone definitions
 * @returns object with totalSec and per-zone seconds
 */
export function computeTimeInZones(
  hrStream: number[] | undefined,
  timeStream: number[] | undefined,
  zones: ZoneDef[]
): { z1: number; z2: number; z3: number; z4: number; z5: number; total: number } | null {
  if (!hrStream || hrStream.length === 0) return null;
  const result = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, total: 0 };

  // If we have a time stream, sum dt between consecutive samples; otherwise assume 1Hz.
  for (let i = 0; i < hrStream.length; i++) {
    const bpm = hrStream[i];
    if (!bpm || bpm < 30 || bpm > 240) continue; // sanity filter
    let dt = 1;
    if (timeStream && i > 0) {
      dt = Math.max(0, timeStream[i] - timeStream[i - 1]);
      if (dt > 60) dt = 1; // gap → don't credit a long pause
    }
    const z = zoneOf(bpm, zones);
    if (z === 1) result.z1 += dt;
    else if (z === 2) result.z2 += dt;
    else if (z === 3) result.z3 += dt;
    else if (z === 4) result.z4 += dt;
    else result.z5 += dt;
    result.total += dt;
  }

  return result;
}

/**
 * Convert per-zone seconds to per-zone minutes (rounded).
 */
export function zoneSecondsToMinutes(zs: {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  total: number;
}): { z1: number; z2: number; z3: number; z4: number; z5: number; total: number } {
  return {
    z1: Math.round(zs.z1 / 60),
    z2: Math.round(zs.z2 / 60),
    z3: Math.round(zs.z3 / 60),
    z4: Math.round(zs.z4 / 60),
    z5: Math.round(zs.z5 / 60),
    total: Math.round(zs.total / 60),
  };
}

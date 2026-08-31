import { DailyMetric, SleepSession } from "@/app/generated/prisma/client";

export interface HealthScoreBreakdown {
  score: number;
  sleepScore: number | null;
  stepsScore: number | null;
  stressScore: number | null;
  regenScore: number | null;
  hasData: boolean;
}

/**
 * Calculates the Daily Health Score (0-100) based on sleep metrics, steps, stress and recovery metrics.
 * Supports partial data by normalizing weights of available components.
 */
export function calculateDailyHealthScore(
  metric?: DailyMetric | null,
  sleep?: SleepSession | null
): HealthScoreBreakdown {
  let totalWeight = 0;
  let weightedSum = 0;

  let sleepScore: number | null = null;
  let stepsScore: number | null = null;
  let stressScore: number | null = null;
  let regenScore: number | null = null;

  // 1. Sleep Component (Weight: 35%)
  if (sleep) {
    if (sleep.efficiency != null && sleep.efficiency > 0) {
      sleepScore = sleep.efficiency;
    } else if (sleep.totalMinutes != null && sleep.totalMinutes > 0) {
      const mins = sleep.totalMinutes;
      if (mins < 360) {
        // Less than 6 hours
        sleepScore = (mins / 480) * 80;
      } else if (mins <= 540) {
        // 6 to 9 hours (optimal around 8h / 480m)
        sleepScore = 100 - Math.abs(mins - 480) * 0.15;
      } else {
        // More than 9 hours
        sleepScore = Math.max(50, 85 - (mins - 540) * 0.1);
      }
    }

    if (sleepScore != null) {
      sleepScore = Math.min(100, Math.max(0, sleepScore));
      weightedSum += sleepScore * 0.35;
      totalWeight += 0.35;
    }
  }

  if (metric) {
    // 2. Steps Component (Weight: 25%)
    if (metric.steps != null) {
      const targetSteps = 10000;
      stepsScore = Math.min(100, (metric.steps / targetSteps) * 100);
      weightedSum += stepsScore * 0.25;
      totalWeight += 0.25;
    }

    // 3. Stress Component (Weight: 20%)
    if (metric.stressScore != null && metric.stressScore >= 0) {
      // stressScore is typically 0-100 (higher = worse)
      stressScore = Math.min(100, Math.max(0, 100 - metric.stressScore));
      weightedSum += stressScore * 0.20;
      totalWeight += 0.20;
    }

    // 4. Recovery Component (Weight: 20% - split between HRV and RHR)
    let hrvScore: number | null = null;
    let rhrScore: number | null = null;

    if (metric.hrv != null && metric.hrv > 0) {
      // Good HRV baseline is usually > 50-60ms. Let's scale up to 70ms.
      hrvScore = Math.min(100, (metric.hrv / 70) * 100);
    }

    if (metric.restingHr != null && metric.restingHr > 0) {
      // Good Resting HR is <= 55 bpm
      if (metric.restingHr <= 52) {
        rhrScore = 100;
      } else {
        rhrScore = Math.max(0, 100 - (metric.restingHr - 52) * 2);
      }
    }

    if (hrvScore != null && rhrScore != null) {
      regenScore = hrvScore * 0.5 + rhrScore * 0.5;
    } else if (hrvScore != null) {
      regenScore = hrvScore;
    } else if (rhrScore != null) {
      regenScore = rhrScore;
    }

    if (regenScore != null) {
      weightedSum += regenScore * 0.20;
      totalWeight += 0.20;
    }
  }

  // If no metrics are available, return 0 score and false for hasData
  if (totalWeight === 0) {
    return {
      score: 0,
      sleepScore: null,
      stepsScore: null,
      stressScore: null,
      regenScore: null,
      hasData: false,
    };
  }

  // Normalize the score based on available data weights
  const finalScore = Math.round(weightedSum / totalWeight);

  return {
    score: Math.min(100, Math.max(0, finalScore)),
    sleepScore: sleepScore != null ? Math.round(sleepScore) : null,
    stepsScore: stepsScore != null ? Math.round(stepsScore) : null,
    stressScore: stressScore != null ? Math.round(stressScore) : null,
    regenScore: regenScore != null ? Math.round(regenScore) : null,
    hasData: true,
  };
}

/**
 * Gets a human-readable description and color class for a given health score.
 */
export function getHealthScoreInterpretation(score: number): {
  label: string;
  colorClass: string;
  bgClass: string;
} {
  if (score >= 90) {
    return { label: "Doskonały", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20" };
  }
  if (score >= 75) {
    return { label: "Świetny", colorClass: "text-lime-400", bgClass: "bg-lime-500/10 border-lime-500/20" };
  }
  if (score >= 60) {
    return { label: "Dobry", colorClass: "text-yellow-400", bgClass: "bg-yellow-500/10 border-yellow-500/20" };
  }
  if (score >= 40) {
    return { label: "Umiarkowany", colorClass: "text-orange-400", bgClass: "bg-orange-500/10 border-orange-500/20" };
  }
  return { label: "Niski", colorClass: "text-rose-400", bgClass: "bg-rose-500/10 border-rose-500/20" };
}

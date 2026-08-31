/**
 * Skierowania (Referral) — status i wygasanie.
 *
 * `EXPIRED` **nie jest zapisywane w tle**: status wygaśnięcia liczymy przy
 * odczycie z `expiryDate`. Unikamy zadania cron, które modyfikowałoby dane bez
 * wiedzy użytkownika — spójne z zasadą „sugestia zawsze, akcja nigdy sama".
 *
 * `isUsed` jest legacy: nowy kod pisze oba pola, ale czyta wyłącznie `status`.
 */

export type ReferralStatus = "ACTIVE" | "FULFILLED" | "EXPIRED" | "CANCELLED";

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "ACTIVE",
  "FULFILLED",
  "EXPIRED",
  "CANCELLED",
];

export function isReferralStatus(v: unknown): v is ReferralStatus {
  return typeof v === "string" && (REFERRAL_STATUSES as string[]).includes(v);
}

export const REFERRAL_STATUS_META: Record<
  ReferralStatus,
  { label: string; badge: string }
> = {
  ACTIVE: {
    label: "Aktywne",
    badge: "bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/30",
  },
  FULFILLED: {
    label: "Zrealizowane",
    badge: "bg-[#2e3229] text-[#8c9282] border border-[#3d4237]",
  },
  EXPIRED: {
    label: "Wygasłe",
    badge: "bg-rose-500/10 text-rose-300 border border-rose-500/30",
  },
  CANCELLED: {
    label: "Anulowane",
    badge: "bg-[#2e3229] text-[#8c9282] border border-[#3d4237] line-through",
  },
};

export function referralStatusMeta(status?: string | null) {
  return (
    REFERRAL_STATUS_META[(status as ReferralStatus) ?? "ACTIVE"] ??
    REFERRAL_STATUS_META.ACTIVE
  );
}

export interface ReferralLike {
  status?: string | null;
  expiryDate?: Date | string | null;
  /** [legacy] — używane tylko jako fallback dla rekordów sprzed migracji. */
  isUsed?: boolean | null;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/** Liczba dni do wygaśnięcia; `null` gdy skierowanie nie ma daty ważności. */
export function daysUntilExpiry(
  r: ReferralLike,
  now: Date = new Date()
): number | null {
  if (!r.expiryDate) return null;
  const expiry = toDate(r.expiryDate);
  if (isNaN(expiry.getTime())) return null;
  // Porównanie po dniach, nie po godzinach — „wygasa dziś" ma dawać 0, nie -1.
  const startOfDay = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (startOfDay(expiry) - startOfDay(now)) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Status faktyczny: zapisany, ale z `ACTIVE` przeliczonym na `EXPIRED`,
 * gdy minęła data ważności.
 */
export function effectiveReferralStatus(
  r: ReferralLike,
  now: Date = new Date()
): ReferralStatus {
  const stored: ReferralStatus = isReferralStatus(r.status)
    ? r.status
    : r.isUsed
    ? "FULFILLED"
    : "ACTIVE";
  if (stored !== "ACTIVE") return stored;
  const days = daysUntilExpiry(r, now);
  return days !== null && days < 0 ? "EXPIRED" : "ACTIVE";
}

export type ExpiryWarning = "none" | "soon" | "urgent" | "expired";

/**
 * Poziom ostrzeżenia o wygaśnięciu — tylko dla skierowań aktywnych.
 * żółte < 30 dni, czerwone < 7 dni.
 */
export function expiryWarning(
  r: ReferralLike,
  now: Date = new Date()
): ExpiryWarning {
  const status = effectiveReferralStatus(r, now);
  if (status === "EXPIRED") return "expired";
  if (status !== "ACTIVE") return "none";
  const days = daysUntilExpiry(r, now);
  if (days === null) return "none";
  if (days < 7) return "urgent";
  if (days < 30) return "soon";
  return "none";
}

/** Tekst ostrzeżenia do UI, np. „wygasa za 5 dni" / „wygasło 3 dni temu". */
export function expiryLabel(r: ReferralLike, now: Date = new Date()): string | null {
  const days = daysUntilExpiry(r, now);
  if (days === null) return null;
  if (days < 0) {
    const n = Math.abs(days);
    return `wygasło ${n} ${n === 1 ? "dzień" : "dni"} temu`;
  }
  if (days === 0) return "wygasa dziś";
  return `wygasa za ${days} ${days === 1 ? "dzień" : "dni"}`;
}

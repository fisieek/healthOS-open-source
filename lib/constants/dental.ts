// Wspólne stałe i walidacja dla modułu stomatologicznego.
// Jedno źródło prawdy dla tras API (`/api/health/dental`, `/api/health/dental/[id]`)
// i formularza w `app/zdrowie/health-client.tsx` — wcześniej `WHOLE_MOUTH_PROCEDURES`
// było zdefiniowane dwa razy, a walidacja zębów rozjeżdżała się między POST (1–48)
// a PATCH (1–32), przez co zęba 47 nie dało się edytować.

/** Zabiegi obejmujące całą jamę ustną — nie wymagają wskazania konkretnego zęba. */
export const WHOLE_MOUTH_PROCEDURES = ["przegląd", "higienizacja"];

/** Czy dany zabieg wymaga wskazania zęba. */
export function procedureNeedsTooth(procedure?: string | null): boolean {
  return !WHOLE_MOUTH_PROCEDURES.includes((procedure ?? "").trim());
}

// Notacja FDI (ISO 3950) — ćwiartki 1–4, pozycje 1–8 w ćwiartce.
export const FDI_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
export const FDI_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
export const FDI_LOWER_LEFT = [38, 37, 36, 35, 34, 33, 32, 31];
export const FDI_LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47, 48];

/**
 * Walidacja numeru zęba w notacji FDI: 11–18, 21–28, 31–38, 41–48.
 *
 * Ostrzejsza niż dotychczasowy zakres `1..48` w POST — odrzuca numery,
 * których FDI nie zna (19, 20, 30, 40, …), a które trasa dotąd przepuszczała.
 */
export function isValidFdiTooth(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  const quadrant = Math.floor(n / 10);
  const position = n % 10;
  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8;
}

/** Lista zabiegów w formularzu — wspólna dla modala i walidacji „czy potrzebny ząb". */
export const DENTAL_PROCEDURE_GROUPS: {
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    label: "Wizyty ogólne",
    options: [
      { value: "przegląd", label: "Przegląd" },
      { value: "higienizacja", label: "Higienizacja (skaling / piaskowanie)" },
    ],
  },
  {
    label: "Zabiegi na zębie",
    options: [
      { value: "plomba", label: "Wypełnienie (plomba)" },
      { value: "leczenie kanałowe", label: "Leczenie kanałowe" },
      { value: "korona", label: "Korona / Most protetyczny" },
      { value: "implant", label: "Implant" },
      { value: "usuwanie", label: "Usuwanie zęba" },
      { value: "konsultacja", label: "Konsultacja" },
    ],
  },
];

/** Wspólny komunikat błędu (PL) — ten sam w obu trasach. */
export const FDI_TOOTH_ERROR =
  "Numer zęba musi być w notacji FDI: 11–18, 21–28, 31–38 lub 41–48.";

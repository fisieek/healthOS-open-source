/**
 * Mapowanie nazw markerów krwi na kategorie.
 * Używane w zakładce "Badania Krwi" w /cialo do filtrowania tabeli.
 *
 * Klucze są lowercase i bez polskich znaków dla łatwego dopasowania.
 */

export type BiomarkerCategory =
  | "Morfologia"
  | "Mikroelementy"
  | "Witaminy"
  | "Hormony"
  | "Lipidogram"
  | "Metabolizm"
  | "Zapalne"
  | "Nerki"
  | "Wątroba"
  | "Mocz"
  | "Inne";

export const BIOMARKER_CATEGORIES: BiomarkerCategory[] = [
  "Morfologia",
  "Mikroelementy",
  "Witaminy",
  "Hormony",
  "Lipidogram",
  "Metabolizm",
  "Zapalne",
  "Nerki",
  "Wątroba",
  "Mocz",
  "Inne",
];

// Mapowanie: fragment nazwy markera (lowercase) → kategoria
const CATEGORY_MAP: [string[], BiomarkerCategory][] = [
  // Morfologia
  [["hgb", "hemoglobin", "hematokryt", "hct", "erytrocyt", "rbc", "leukocyt", "wbc", "płytk", "plt", "mcv", "mch", "mchc", "rdw", "neutrofil", "limfocyt", "monocyt", "eozynofil", "bazofil", "morfologia", "mpv", "pdw", "p-lcr", "pct", "niedojrz", "granulocyt"], "Morfologia"],
  // Mikroelementy
  [["ferrytyn", "żelazo", "iron", "cynk", "zinc", "magnez", "magnesium", "selen", "selenium", "miedź", "copper", "mangan", "jod", "iodine", "chrom", "chromium", "tibc", "transferyn"], "Mikroelementy"],
  // Witaminy
  [["witamina", "vitamin", "25(oh)", "25-oh", "vit d", "vit b", "b12", "b6", "kwas foliow", "folate", "folic", "biotyna", "biotin", "kobalamina"], "Witaminy"],
  // Hormony
  [["tsh", "t3", "t4", "ft3", "ft4", "testosteron", "testosterone", "estradiol", "estrogen", "progesteron", "progesterone", "kortyzol", "cortisol", "insulina", "insulin", "igf", "dhea", "prolaktyn", "prolactin", "lh", "fsh", "amh", "shbg", "pth", "hormon"], "Hormony"],
  // Lipidogram
  [["cholesterol", "hdl", "ldl", "vldl", "trigliceryd", "triglyceride", "tg", "non-hdl", "apolipoprotein", "apo a", "apo b", "lipidogram", "lipid", "lipoproteina"], "Lipidogram"],
  // Metabolizm
  [["glukoza", "glucose", "hba1c", "hemoglobina glikowana", "insulinooporność", "homa", "kwas moczowy", "uric acid", "kreatynina", "creatinine", "egfr", "mocznik", "urea", "bun", "albumin", "białko całkowite", "total protein"], "Metabolizm"],
  // Zapalne
  [["crp", "c-reactive", "białko c-reaktywne", "il-6", "interleukina", "tnf", "opad", "esr", "odczyn biernackiego", "fibrynogen", "fibrinogen", "prokalcytonin", "procalcitonin", "ferrytyn"], "Zapalne"],
  // Nerki
  [["kreatynin", "creatinin", "egfr", "mocznik", "urea", "bun", "kwas moczowy", "uric", "cystatyna", "cystatin", "mikroalbuminuria", "microalbumin", "nerki", "kidney"], "Nerki"],
  // Wątroba
  [["alt", "alat", "ast", "aspat", "ggtp", "ggt", "alp", "fosfataza", "bilirubina", "bilirubin", "albumin", "ldh", "wątroba", "liver", "hepat"], "Wątroba"],
  // Mocz
  [["mocz", "urine", "ciezar wlasciwy", "ph moczu", "azotyny", "urobilinogen", "bilirubina w moczu", "barwa moczu", "osad", "bakterie w moczu"], "Mocz"],
];

/**
 * Zwraca kategorię dla danej nazwy markera.
 * Dopasowanie jest case-insensitive i ignoruje polskie znaki.
 */
export function getBiomarkerCategory(markerName: string): BiomarkerCategory {
  const normalized = markerName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const [keywords, category] of CATEGORY_MAP) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) return category;
    }
  }
  return "Inne";
}

/**
 * Grupuje listę markerów według kategorii.
 */
export function groupMarkersByCategory<T extends { name: string }>(
  markers: T[]
): Record<BiomarkerCategory, T[]> {
  const result = {} as Record<BiomarkerCategory, T[]>;
  for (const cat of BIOMARKER_CATEGORIES) {
    result[cat] = [];
  }
  for (const marker of markers) {
    const cat = getBiomarkerCategory(marker.name);
    result[cat].push(marker);
  }
  return result;
}

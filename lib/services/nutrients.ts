import { prisma } from "@/lib/db";

export interface NutrientLite {
  id: string;
  slug: string;
  name: string;
  defaultUnit: string;
  rda: number | null;
  upperLimit?: number | null;
  aliases: string[];
}

let cachedNutrients: NutrientLite[] | null = null;

export async function getAllNutrients(): Promise<NutrientLite[]> {
  if (cachedNutrients) return cachedNutrients;
  const list = await prisma.nutrient.findMany({
    select: { id: true, slug: true, name: true, defaultUnit: true, rda: true, upperLimit: true, aliases: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  const mappedList = list.map((n) => ({
    ...n,
    aliases: Array.isArray(n.aliases) ? (n.aliases as string[]) : [],
  }));
  cachedNutrients = mappedList;
  return mappedList;
}

export function clearNutrientsCache() {
  cachedNutrients = null;
}

// ─── Name normalization & matching ────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[()[\],./\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Try to match a free-text ingredient name to a canonical Nutrient.
 * Strategy: exact normalized match against name + aliases, then substring containment.
 */
export function matchNutrient(rawName: string, nutrients: NutrientLite[]): NutrientLite | null {
  const target = normalize(rawName);
  if (!target) return null;

  // 1) exact match against name or alias
  for (const n of nutrients) {
    if (normalize(n.name) === target) return n;
    for (const alias of n.aliases) {
      if (normalize(alias) === target) return n;
    }
  }

  // 2) word-level: alias contained as a whole token
  const targetTokens = new Set(target.split(" "));
  for (const n of nutrients) {
    const candidates = [n.name, ...n.aliases];
    for (const c of candidates) {
      const cn = normalize(c);
      if (!cn) continue;
      // alias is multi-word and fully present
      if (cn.includes(" ") && target.includes(cn)) return n;
      // alias is single word and matches a target token
      if (!cn.includes(" ") && targetTokens.has(cn)) return n;
    }
  }

  return null;
}

// ─── Unit conversion ──────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  mcg: "μg",
  µg: "μg",
  ug: "μg",
  "u.g.": "μg",
};

function canonUnit(u: string | null | undefined): string | null {
  if (!u) return null;
  const trimmed = u.trim();
  return UNIT_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Convert amount from `fromUnit` to `toUnit` for a given nutrient.
 * Returns null if conversion not possible.
 *
 * Handles:
 *  - identical units
 *  - mg ↔ μg (×1000)
 *  - g ↔ mg (×1000)
 *  - IU ↔ μg/mg for known nutrients (Vitamin A, D, E)
 */
export function convertAmount(
  amount: number,
  fromUnit: string | null | undefined,
  toUnit: string,
  nutrientSlug?: string
): number | null {
  const from = canonUnit(fromUnit);
  const to = canonUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return amount;

  // Mass conversions
  const massScale: Record<string, number> = { g: 1_000_000, mg: 1_000, μg: 1 };
  if (from in massScale && to in massScale) {
    return (amount * massScale[from]) / massScale[to];
  }

  // IU conversions (only for known nutrients)
  if (from === "IU" || to === "IU") {
    const iuToMicrograms: Record<string, number> = {
      "vitamin-a": 0.3,    // 1 IU retinol = 0.3 μg
      "vitamin-d": 0.025,  // 1 IU = 0.025 μg
    };
    const iuToMilligrams: Record<string, number> = {
      "vitamin-e": 0.000667, // 1 IU = 0.000667 mg α-tocopherol
    };
    if (nutrientSlug && iuToMicrograms[nutrientSlug] !== undefined) {
      const ug = (from === "IU" ? amount : amount / iuToMicrograms[nutrientSlug]) * (from === "IU" ? iuToMicrograms[nutrientSlug] : 1);
      // convert μg → target
      return convertAmount(ug, "μg", to);
    }
    if (nutrientSlug && iuToMilligrams[nutrientSlug] !== undefined) {
      const mg = (from === "IU" ? amount : amount / iuToMilligrams[nutrientSlug]) * (from === "IU" ? iuToMilligrams[nutrientSlug] : 1);
      return convertAmount(mg, "mg", to);
    }
  }

  return null;
}

import { getGeminiApiKey } from "@/lib/ai/gemini-key";

export interface SupplementIngredientResult {
  name: string;
  amount: number | null;
  unit: string | null;
  percentDV: number | null;
}

export interface SupplementLabelResult {
  productName: string;
  company: string;
  servingSize: number | null;
  servingUnit: string | null;
  ingredients: SupplementIngredientResult[];
}

export function repairTruncatedJson(str: string): string {
  let json = str.trim();
  if (!json) return "{}";

  // Strip markdown code fences if present
  json = json.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();

  // Pass 1: close any open string
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    if (json[i] === '\\' && !escaped) {
      escaped = true;
    } else {
      if (json[i] === '"' && !escaped) {
        inString = !inString;
      }
      escaped = false;
    }
  }
  if (inString) {
    json += '"';
  }

  // Pass 2: strip trailing junk (commas, colons, incomplete keys) after closing the string
  json = json.trim();
  // Remove trailing comma/colon/open-brace/open-bracket sequences
  while (/[,:{[]$/.test(json)) {
    json = json.slice(0, -1).trim();
  }

  // Pass 3: balance braces and brackets
  const stack: string[] = [];
  inString = false;
  escaped = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === '"' && !escaped) {
      inString = !inString;
    }
    escaped = false;

    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  // Close open brackets/braces in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    json += open === '{' ? '}' : ']';
  }

  return json;
}

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

const PROMPT = `Analyze this supplement label image. Extract:
- productName: the full product name printed on the packaging
- company: the manufacturer or brand company name
- servingSize: numeric size of one serving (e.g. 2 if "2 tablets per serving", 1 if "1 capsule")
- servingUnit: unit of the serving (e.g. "tabletka", "kapsułka", "ml", "scoop", "tablet", "capsule")
- ingredients: an array of ALL listed nutrients, vitamins, minerals with their amounts PER ONE SERVING.
  Use Polish nutrient names where possible (e.g. "Witamina C", "Magnez", "Cynk").
  For ingredients listed only as part of a complex (e.g. "kompleks B"), expand into individual nutrients if amounts are given.

Return ONLY a valid JSON object in exactly this format, no markdown, no explanation:
{
  "productName": "string",
  "company": "string",
  "servingSize": number_or_null,
  "servingUnit": "string_or_null",
  "ingredients": [
    { "name": "string", "amount": number_or_null, "unit": "string_or_null", "percentDV": number_or_null }
  ]
}

For each ingredient: amount is a number (e.g. 500), unit is the unit string (mg, μg, IU, %, etc.), percentDV is the % RWS/NRV value if listed or null.`;

export async function analyzeSupplementLabel(
  userId: string,
  imageBase64: string,
  mimeType: string
): Promise<SupplementLabelResult> {
  const apiKey = await getGeminiApiKey(userId);

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
  const repaired = repairTruncatedJson(cleaned);

  try {
    return JSON.parse(repaired) as SupplementLabelResult;
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
}


// ─── Universal health intake: classify + extract ─────────────────────────────

const GEMINI_PRO_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

const CLASSIFY_KINDS = [
  "BODY_COMPOSITION",
  "BLOOD_TEST",
  "HORMONES_TEST",
  "IMAGING_REPORT",
  "MEDICATION_LABEL",
  "SUPPLEMENT_LABEL",
  "WELLNESS_REPORT",
  "PRESCRIPTION",
  "OTHER",
] as const;
export type IntakeKindLabel = (typeof CLASSIFY_KINDS)[number];

const CLASSIFY_PROMPT = `Classify this health-related document or photo into ONE of these categories:

- BODY_COMPOSITION — smart-scale screenshot or report (weight, BMI, body fat, muscle mass, water %, visceral fat, BMR, body type/score). Brands: Xiaomi/Mi, Tanita, Withings, Garmin Index, Fitbit Aria, etc.
- BLOOD_TEST — laboratory blood test results (hematology, lipids, glucose, ferritin, etc.)
- HORMONES_TEST — hormone panel (TSH, T3/T4, testosterone, estrogen, cortisol, etc.)
- IMAGING_REPORT — radiology report (X-ray, MRI, CT, ultrasound, bone density)
- MEDICATION_LABEL — prescription medication packaging or info leaflet
- SUPPLEMENT_LABEL — dietary supplement label (vitamins/minerals/herbs)
- WELLNESS_REPORT — generic wearable/app summary (sleep report, weekly fitness summary)
- PRESCRIPTION — doctor's prescription / referral
- OTHER — anything else, including unreadable / unclear images

Return ONLY a valid JSON object, no markdown:
{
  "kind": "BODY_COMPOSITION" | "BLOOD_TEST" | "HORMONES_TEST" | "IMAGING_REPORT" | "MEDICATION_LABEL" | "SUPPLEMENT_LABEL" | "WELLNESS_REPORT" | "PRESCRIPTION" | "OTHER",
  "confidence": number (0.0-1.0),
  "reason": "one short sentence explaining the classification",
  "title": "short human-readable title for this document, in Polish (e.g. 'Ważenie Xiaomi 12 maja', 'Morfologia krew')",
  "sourceLabel": "device/app/lab name if visible (e.g. 'Xiaomi Body Scale S400', 'Synevo'), or null",
  "documentDate": "ISO date YYYY-MM-DD if visible on the document, else null"
}`;

export interface ClassifyResult {
  kind: IntakeKindLabel;
  confidence: number;
  reason: string;
  title: string;
  sourceLabel: string | null;
  documentDate: string | null;
}

async function callGeminiMultimodal(
  userId: string,
  prompt: string,
  images: { base64: string; mimeType: string } | { base64: string; mimeType: string }[] | string,
  mimeTypeOrConfig?: string | { maxOutputTokens?: number; temperature?: number },
  config?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  const apiKey = await getGeminiApiKey(userId);

  let imageArray: { base64: string; mimeType: string }[] = [];
  let actualConfig: { maxOutputTokens?: number; temperature?: number } = {};

  if (typeof images === "string") {
    const base64 = images;
    const mimeType = typeof mimeTypeOrConfig === "string" ? mimeTypeOrConfig : "image/jpeg";
    imageArray = [{ base64, mimeType }];
    actualConfig = config || {};
  } else if (Array.isArray(images)) {
    imageArray = images;
    actualConfig = (mimeTypeOrConfig as { maxOutputTokens?: number; temperature?: number }) || {};
  } else {
    imageArray = [images];
    actualConfig = (mimeTypeOrConfig as { maxOutputTokens?: number; temperature?: number }) || {};
  }

  const parts = [
    { text: prompt },
    ...imageArray.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    })),
  ];

  const body = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: actualConfig.temperature ?? 0.1,
      maxOutputTokens: actualConfig.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(`${GEMINI_PRO_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
  return cleaned;
}

/**
 * Classify a health document/photo. Always returns something — falls back to OTHER on parse errors.
 */
export async function classifyHealthIntake(
  userId: string,
  fileBase64: string,
  mimeType: string
): Promise<ClassifyResult> {
  const text = await callGeminiMultimodal(userId, CLASSIFY_PROMPT, fileBase64, mimeType, {
    maxOutputTokens: 2048,
  });

  let parsed: Record<string, unknown>;
  const repaired = repairTruncatedJson(text);
  try {
    parsed = JSON.parse(repaired);
  } catch {
    return {
      kind: "OTHER",
      confidence: 0.0,
      reason: `Couldn't parse classifier response: ${text.slice(0, 100)}`,
      title: "Niezidentyfikowany dokument",
      sourceLabel: null,
      documentDate: null,
    };
  }

  const rawKind = String(parsed.kind ?? "OTHER").toUpperCase();
  const kind = (CLASSIFY_KINDS as readonly string[]).includes(rawKind)
    ? (rawKind as IntakeKindLabel)
    : "OTHER";

  return {
    kind,
    confidence:
      typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    title: typeof parsed.title === "string" ? parsed.title : "Dokument zdrowotny",
    sourceLabel: typeof parsed.sourceLabel === "string" ? parsed.sourceLabel : null,
    documentDate: typeof parsed.documentDate === "string" ? parsed.documentDate : null,
  };
}

// ─── Body composition extractor ───────────────────────────────────────────────

const BODY_COMPOSITION_PROMPT = `Analyze this body composition / smart scale screenshot or report.
Extract ALL visible body composition metrics. Use null for any value that is NOT clearly visible.
Do NOT invent or estimate values. If a metric isn't on the screen, return null.

Return ONLY valid JSON, no markdown:
{
  "measuredAt": "ISO datetime if a timestamp is visible (else null)",
  "sourceLabel": "device or app name if visible (e.g. 'Xiaomi Body Scale S400', 'Mi Fitness', 'Tanita'), else null",
  "weight": number_or_null,        // kg
  "bmi": number_or_null,
  "bodyFat": number_or_null,       // % (tkanka tłuszczowa %)
  "leanBodyMass": number_or_null,  // kg, fat-free mass (waga bez tłuszczu / FFM)
  "boneMass": number_or_null,      // kg (zawartość minerałów kości)
  "bodyWaterPct": number_or_null,  // % (woda w organizmie %)
  "proteinPct": number_or_null,    // % (białko procentowe %)
  "visceralFat": number_or_null,   // unitless index, usually 1-30 (tłuszcz trzewny)
  "basalMetabolism": number_or_null, // BMR in kcal/day (podstawowa przemiana materii)
  "metabolicAge": number_or_null,  // years (wiek biologiczny / metaboliczny)
  "bodyType": string_or_null,      // e.g. "balanced muscular", "skinny fat", "obese", in original language (sylwetka / typ sylwetki)
  "bodyScore": number_or_null,     // overall composite score 0-100 (Xiaomi/Withings) (wynik zdrowotny / punkty)
  "idealWeight": number_or_null,   // kg, target weight suggested by the device
  "skeletalMusclePct": number_or_null, // % skeletal muscle
  
  // New advanced body scale metrics
  "waterMass": number_or_null,     // kg (masa wody)
  "fatMass": number_or_null,       // kg (masa tłuszczu)
  "proteinMass": number_or_null,   // kg (masa białka)
  "musclePct": number_or_null,     // % (procent mięśni / procentowa zawartość mięśni)
  "bonePct": number_or_null,       // % (minerały kości procentowe)
  "skeletalMuscleMass": number_or_null, // kg (masa mięśni szkieletowych)
  "waistToHipRatio": number_or_null // WHR ratio, e.g. 0.7 (szacowane proporcje obwodu pasa do bioder / WHR)
}

Notes:
- Weight: prefer kg. Convert lb to kg if needed (1 lb = 0.4536 kg).
- If multiple readings shown (e.g. trend chart), use the MOST RECENT.
- Polish translation mappings:
  - "Waga" / "Masa ciała" → weight
  - "BMI" → bmi
  - "Tłuszcz %" / "Zawartość tłuszczu %" / "Tkanka tłuszczowa" → bodyFat
  - "Waga ciała bez tkanki tłuszczowej" / "Masa bez tłuszczu" / "FFM" → leanBodyMass
  - "Zawartość minerałów kości" / "Masa kości" → boneMass
  - "Woda w organizmie" / "Woda %" / "Stopień uwodnienia" → bodyWaterPct
  - "Białko procentowe" / "Białko %" → proteinPct
  - "Ocena tłuszczu trzewnego" / "Tłuszcz trzewny" → visceralFat
  - "BMR" / "Podstawowa przemiana materii" / "PPM" → basalMetabolism
  - "Wiek biologiczny" / "Wiek metaboliczny" → metabolicAge
  - "Sylwetka" / "Typ sylwetki" → bodyType
  - "Wynik dotyczący ciała" / "Wynik zdrowotny" / "Punkty" → bodyScore
  - "Masa wody" → waterMass
  - "Masa tłuszczu" → fatMass
  - "Masa białka" → proteinMass
  - "Procent mięśni" → musclePct
  - "Minerały kości procentowe" → bonePct
  - "Masa mięśni szkieletowych" → skeletalMuscleMass
  - "Szacowane proporcje obwodu pasa do bioder" / "WHR" → waistToHipRatio`;

export interface BodyCompositionResult {
  measuredAt: string | null;
  sourceLabel: string | null;
  weight: number | null;
  bmi: number | null;
  bodyFat: number | null;
  leanBodyMass: number | null;
  muscleMass: number | null;
  boneMass: number | null;
  bodyWaterPct: number | null;
  proteinPct: number | null;
  visceralFat: number | null;
  basalMetabolism: number | null;
  metabolicAge: number | null;
  bodyType: string | null;
  bodyScore: number | null;
  idealWeight: number | null;
  skeletalMusclePct: number | null;
  
  // New fields
  waterMass: number | null;
  fatMass: number | null;
  proteinMass: number | null;
  musclePct: number | null;
  bonePct: number | null;
  skeletalMuscleMass: number | null;
  waistToHipRatio: number | null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Sanity-check ranges; null out absurd values (e.g. weight=999). */
function sanityCheck(r: BodyCompositionResult): BodyCompositionResult {
  const inRange = (v: number | null, lo: number, hi: number) =>
    v != null && v >= lo && v <= hi ? v : null;
  return {
    ...r,
    weight: inRange(r.weight, 20, 250),
    bmi: inRange(r.bmi, 10, 60),
    bodyFat: inRange(r.bodyFat, 2, 60),
    leanBodyMass: inRange(r.leanBodyMass, 20, 150),
    muscleMass: inRange(r.muscleMass, 10, 80),
    boneMass: inRange(r.boneMass, 1, 6),
    bodyWaterPct: inRange(r.bodyWaterPct, 30, 80),
    proteinPct: inRange(r.proteinPct, 5, 30),
    visceralFat: inRange(r.visceralFat, 0, 40),
    basalMetabolism: inRange(r.basalMetabolism, 800, 4000),
    metabolicAge: inRange(r.metabolicAge, 5, 100),
    bodyScore: inRange(r.bodyScore, 0, 100),
    idealWeight: inRange(r.idealWeight, 30, 150),
    skeletalMusclePct: inRange(r.skeletalMusclePct, 10, 95),
    
    // New fields ranges
    waterMass: inRange(r.waterMass, 10, 150),
    fatMass: inRange(r.fatMass, 1, 100),
    proteinMass: inRange(r.proteinMass, 1, 50),
    musclePct: inRange(r.musclePct, 10, 95),
    bonePct: inRange(r.bonePct, 0.1, 20),
    skeletalMuscleMass: inRange(r.skeletalMuscleMass, 5, 100),
    waistToHipRatio: inRange(r.waistToHipRatio, 0.2, 2.0),
  };
}

export async function extractBodyComposition(
  userId: string,
  imagesOrBase64: string | { base64: string; mimeType: string }[],
  mimeType?: string
): Promise<BodyCompositionResult> {
  const inputImages = typeof imagesOrBase64 === "string" 
    ? { base64: imagesOrBase64, mimeType: mimeType || "image/jpeg" }
    : imagesOrBase64;

  const text = await callGeminiMultimodal(userId, BODY_COMPOSITION_PROMPT, inputImages, {
    maxOutputTokens: 2048,
  });

  let parsed: Record<string, unknown>;
  const repaired = repairTruncatedJson(text);
  try {
    parsed = JSON.parse(repaired);
  } catch {
    throw new Error(`Body composition extractor returned non-JSON: ${text.slice(0, 200)}`);
  }

  const result: BodyCompositionResult = {
    measuredAt: str(parsed.measuredAt),
    sourceLabel: str(parsed.sourceLabel),
    weight: num(parsed.weight),
    bmi: num(parsed.bmi),
    bodyFat: num(parsed.bodyFat),
    leanBodyMass: num(parsed.leanBodyMass),
    muscleMass: num(parsed.muscleMass),
    boneMass: num(parsed.boneMass),
    bodyWaterPct: num(parsed.bodyWaterPct),
    proteinPct: num(parsed.proteinPct),
    visceralFat: num(parsed.visceralFat),
    basalMetabolism: num(parsed.basalMetabolism),
    metabolicAge: num(parsed.metabolicAge),
    bodyType: str(parsed.bodyType),
    bodyScore: num(parsed.bodyScore),
    idealWeight: num(parsed.idealWeight),
    skeletalMusclePct: num(parsed.skeletalMusclePct),
    
    // New fields
    waterMass: num(parsed.waterMass),
    fatMass: num(parsed.fatMass),
    proteinMass: num(parsed.proteinMass),
    musclePct: num(parsed.musclePct),
    bonePct: num(parsed.bonePct),
    skeletalMuscleMass: num(parsed.skeletalMuscleMass),
    waistToHipRatio: num(parsed.waistToHipRatio),
  };

  return sanityCheck(result);
}

// ─── Running activity photo extractor ────────────────────────────────────────

const RUNNING_EXTRACT_PROMPT = `Analyze this photo of a running activity (usually a smartwatch face, sports watch screen like Garmin, Polar, Coros, Apple Watch, or a screenshot of a running app like Strava, Nike Run Club, Garmin Connect).
Extract the following running parameters if they are visible on the image. Return null for any parameter that is NOT clearly visible. Do NOT invent or estimate values.

Return ONLY a valid JSON object in exactly this format, no markdown, no explanation:
{
  "distanceKm": number_or_null,      // distance in kilometers (e.g. 5.0, 10.42, 21.1)
  "durationSec": number_or_null,     // duration in seconds (e.g. 3600 for 1:00:00, 1500 for 25:00)
  "avgHr": number_or_null,           // average heart rate in bpm
  "maxHr": number_or_null,           // maximum heart rate in bpm
  "calories": number_or_null,        // calories burned (kcal)
  "elevGain": number_or_null,        // elevation gain in meters (if visible)
  "date": "string_or_null",          // ISO date YYYY-MM-DD of the activity if visible, else null
  "deviceName": "string_or_null",    // brand/model of the watch or app (e.g. "Garmin Forerunner", "Polar Grit X", "Apple Watch", "Strava") if visible, else null
  "zoneMinutes": {
    "z1": number_or_null,            // minutes spent in Heart Rate Zone 1 (if visible)
    "z2": number_or_null,            // minutes spent in Heart Rate Zone 2 (if visible)
    "z3": number_or_null,            // minutes spent in Heart Rate Zone 3 (if visible)
    "z4": number_or_null,            // minutes spent in Heart Rate Zone 4 (if visible)
    "z5": number_or_null             // minutes spent in Heart Rate Zone 5 (if visible)
  },
  "notes": "string_or_null"          // any extra text, title, or interesting workout metrics visible on the screen
}

Notes for extraction:
- Convert pace or duration if expressed in hh:mm:ss or mm:ss to seconds. For example, a time of "45:30" means 2730 seconds. A time of "1:15:20" means 4520 seconds.
- Pay close attention to Polish terms: "dystans" or "odległość" is distance, "tempo" is average pace, "czas" is duration/time, "tętno" or "HR" is heart rate, "średnie tętno" or "śr. tętno" is avgHr, "maks. tętno" is maxHr, "kalorie" or "kcal" is calories, "wznios" or "suma wzniesień" is elevGain.
- If duration is represented as "01:23:45", that is 1 hour, 23 minutes, 45 seconds (5025 seconds). If it is "45:12", that is 45 minutes, 12 seconds (2712 seconds). Make sure not to mix up hours/minutes/seconds!
- If the image contains a chart or multiple workouts, extract the parameters for the most prominent or main workout displayed.`;

export interface RunningActivityExtractResult {
  distanceKm: number | null;
  durationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevGain: number | null;
  date: string | null;
  deviceName: string | null;
  zoneMinutes: {
    z1: number | null;
    z2: number | null;
    z3: number | null;
    z4: number | null;
    z5: number | null;
  } | null;
  notes: string | null;
}

function parseRunningExtract(parsed: Record<string, any>): RunningActivityExtractResult {
  const parseZone = (z: any) => {
    if (!z || typeof z !== "object") return null;
    return {
      z1: num(z.z1),
      z2: num(z.z2),
      z3: num(z.z3),
      z4: num(z.z4),
      z5: num(z.z5),
    };
  };

  return {
    distanceKm: num(parsed.distanceKm),
    durationSec: num(parsed.durationSec),
    avgHr: num(parsed.avgHr),
    maxHr: num(parsed.maxHr),
    calories: num(parsed.calories),
    elevGain: num(parsed.elevGain),
    date: str(parsed.date),
    deviceName: str(parsed.deviceName),
    zoneMinutes: parseZone(parsed.zoneMinutes),
    notes: str(parsed.notes),
  };
}

function sanityCheckRunning(r: RunningActivityExtractResult): RunningActivityExtractResult {
  const inRange = (v: number | null, lo: number, hi: number) =>
    v != null && v >= lo && v <= hi ? v : null;
  return {
    ...r,
    distanceKm: inRange(r.distanceKm, 0.05, 500),
    durationSec: inRange(r.durationSec, 5, 86400 * 2), // up to 48 hours
    avgHr: inRange(r.avgHr, 35, 240),
    maxHr: inRange(r.maxHr, 45, 250),
    calories: inRange(r.calories, 1, 20000),
    elevGain: inRange(r.elevGain, 0, 10000),
    zoneMinutes: r.zoneMinutes ? {
      z1: inRange(r.zoneMinutes.z1, 0, 1440),
      z2: inRange(r.zoneMinutes.z2, 0, 1440),
      z3: inRange(r.zoneMinutes.z3, 0, 1440),
      z4: inRange(r.zoneMinutes.z4, 0, 1440),
      z5: inRange(r.zoneMinutes.z5, 0, 1440),
    } : null,
  };
}

// ─── Strength workout photo extractor (Gymlify / Hevy reports) ───────────────

const STRENGTH_EXTRACT_PROMPT = `Analyze this strength training workout report or screenshot (from apps like Gymlify, Hevy, Strong, or a handwritten log).
Extract the complete workout data. Return null for any value that is NOT clearly visible. Do NOT invent values.

Return ONLY valid JSON, no markdown:
{
  "workoutName": "string_or_null",       // e.g. "FBW A", "Upper Body", "Push Day"
  "date": "YYYY-MM-DD_or_null",          // date of the workout if visible
  "durationSec": number_or_null,         // total workout duration in seconds
  "notes": "string_or_null",             // any workout notes or comments
  "exercises": [
    {
      "name": "string",                  // exercise name (use original language from report)
      "order": number,                   // order in workout (1-based)
      "muscleGroup": "string_or_null",   // suggested muscle group. Must be exactly one of: CHEST, BACK, LEGS, SHOULDERS, BICEPS, TRICEPS, CORE, CALVES, FOREARMS, CARDIO, PLYO, STRETCHING, OTHER
      "sets": [
        {
          "setNumber": number,           // set number (1-based)
          "weight": number_or_null,      // weight in kg (convert lbs if needed: 1 lb = 0.4536 kg)
          "reps": number_or_null,        // number of repetitions
          "duration": number_or_null,    // duration in seconds (for time-based exercises like Orbitrek, Plank, Cardio, etc. Convert min to sec: e.g., 30 min = 1800, 02:15 = 135)
          "rpe": number_or_null,         // RPE/RIR if shown (0-10 scale)
          "notes": "string_or_null"      // set-level notes if any
        }
      ]
    }
  ]
}

Notes:
- For each exercise, analyze its name and use your extensive medical/anatomical/fitness knowledge to classify the targeted muscle group in the "muscleGroup" field. Must be exactly one of: CHEST (klatka), BACK (plecy), LEGS (uda), SHOULDERS (barki), BICEPS (biceps), TRICEPS (triceps), CORE (brzuch/core), CALVES (łydki), FOREARMS (przedramiona), CARDIO (kardio/aerobik), PLYO (pylo/skoki), STRETCHING (rozciąganie), OTHER (inne). For example: "Szrugsy" -> BACK (or SHOULDERS), "Goblet Squat" -> LEGS, "Brzuszki" -> CORE, "Orbitrek" -> CARDIO, "Box Jump" -> PLYO, "Rozciąganie" -> STRETCHING.
- For bodyweight exercises (e.g. pull-ups, dips), weight = 0 unless additional weight is shown.
- For time-based exercises (e.g. Orbitrek, Plank, stationary bike, treadmill, cardio), extract the duration of the set or session in seconds in the "duration" field, and set "reps" and "weight" to null.
- For repetitions-only exercises without weights (e.g. crunches/brzuszki, pushups/pompki), set "reps" to the number of repetitions and "weight" to null.
- If weight is in lbs, convert to kg.
- Gymlify reports typically show: exercise name, sets × reps × weight (or duration). Extract all sets.
- If the report shows "3 × 10 × 80kg", that means 3 sets of 10 reps at 80kg.
- If the report shows "Orbitrek: 30:00" or similar, that means 1 set with duration of 1800 seconds (30 minutes).
- Polish terms: "seria" = set, "powtórzenia" = reps, "ciężar" = weight, "czas" / "czas trwania" = duration, "ćwiczenie" = exercise.`;

export interface StrengthSetResult {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  duration: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface StrengthExerciseResult {
  name: string;
  order: number;
  muscleGroup: string | null;
  sets: StrengthSetResult[];
}

export interface StrengthWorkoutResult {
  workoutName: string | null;
  date: string | null;
  durationSec: number | null;
  notes: string | null;
  exercises: StrengthExerciseResult[];
}

export async function extractStrengthWorkoutFromPhoto(
  userId: string,
  fileBase64: string,
  mimeType: string
): Promise<StrengthWorkoutResult> {
  const text = await callGeminiMultimodal(userId, STRENGTH_EXTRACT_PROMPT, fileBase64, mimeType, {
    maxOutputTokens: 8192,
    temperature: 0.05,
  });

  let parsed: Record<string, unknown>;
  const repaired = repairTruncatedJson(text);
  try {
    parsed = JSON.parse(repaired);
  } catch {
    throw new Error(`Strength extractor returned non-JSON: ${text.slice(0, 200)}`);
  }

  const exercises: StrengthExerciseResult[] = [];
  if (Array.isArray(parsed.exercises)) {
    for (const ex of parsed.exercises) {
      if (!ex || typeof ex !== "object") continue;
      const sets: StrengthSetResult[] = [];
      if (Array.isArray(ex.sets)) {
        for (const s of ex.sets) {
          sets.push({
            setNumber: typeof s.setNumber === "number" ? s.setNumber : sets.length + 1,
            weight: num(s.weight),
            reps: num(s.reps),
            duration: num(s.duration),
            rpe: num(s.rpe),
            notes: str(s.notes),
          });
        }
      }
      exercises.push({
        name: typeof ex.name === "string" ? ex.name : "Ćwiczenie",
        order: typeof ex.order === "number" ? ex.order : exercises.length + 1,
        muscleGroup: typeof ex.muscleGroup === "string" ? ex.muscleGroup : null,
        sets,
      });
    }
  }

  return {
    workoutName: str(parsed.workoutName),
    date: str(parsed.date),
    durationSec: num(parsed.durationSec),
    notes: str(parsed.notes),
    exercises,
  };
}

export async function extractRunningActivityFromPhoto(
  userId: string,
  fileBase64: string,
  mimeType: string
): Promise<RunningActivityExtractResult> {
  const text = await callGeminiMultimodal(userId, RUNNING_EXTRACT_PROMPT, fileBase64, mimeType, {
    maxOutputTokens: 1024,
  });

  let parsed: Record<string, unknown>;
  const repaired = repairTruncatedJson(text);
  try {
    parsed = JSON.parse(repaired);
  } catch {
    throw new Error(`Running activity extractor returned non-JSON: ${text.slice(0, 200)}`);
  }

  const result = parseRunningExtract(parsed);
  return sanityCheckRunning(result);
}

// ─── Blood / Laboratory test photo extractor ────────────────────────────────

export interface BloodTestParameter {
  name: string;
  value: string;
  unit: string;
}

export interface BloodTestExtractResult {
  studyDate: string | null;
  laboratory: string | null;
  parameters: BloodTestParameter[];
}

const BLOOD_TEST_EXTRACT_PROMPT = `Analyze this lab test report or blood/urine/hormone analysis document (image, scan, or PDF).
Extract:
- studyDate: ISO date YYYY-MM-DD of the study if visible, else null.
- laboratory: name of the lab (e.g. "Diagnostyka", "ALAB", "Synevo") if visible, else null.
- parameters: an array of ALL visible parameters/biomarkers with their values and units.

For each parameter:
- name: full name of the biomarker, e.g. "Leukocyty (WBC)", "Hemoglobina (HGB)", "TSH", "Erytrocyty (RBC)", "Glukoza" (keep in original Polish if listed that way, or map to standard names from the list if possible).
- value: numeric value as a string (convert decimal comma to point, e.g. "5,4" -> "5.4"). If value is not a simple number, e.g. "obecna", "nieobecna", "> 100", keep as is. PRESERVE comparison operators like ">90" or "<0.6" exactly as printed.
- unit: unit of the value, e.g. "tys/µl", "mg/dl", "µIU/ml", "%", "g/dl", "G/l". Use standard abbreviations.

CRITICAL — Differential blood count (rozmaz krwi):
A single report may list the SAME cell line (neutrofile, limfocyty, monocyty, eozynofile, bazofile, niedojrzałe granulocyty / IG, NRBC) TWICE:
once as an ABSOLUTE count (unit "tys/µl" or "G/l", e.g. "Liczba neutrocytów", "Neutrofile (NEUT)") and
once as a PERCENTAGE (unit "%", e.g. "% neutrocytów", "Neutrofile % (NEUT%)").
You MUST extract BOTH variants as SEPARATE entries with DISTINCT names that reflect the variant
(prefix the percent variant with "%" or suffix it with "%", e.g. "% neutrocytów" or "Neutrofile % (NEUT%)").
Never merge or skip a variant. Names must be unique within the parameters array.

CRITICAL — Urinalysis (badanie moczu):
A urinalysis ("Badanie ogólne moczu") report contains parameters whose NAMES collide with blood biomarkers
(e.g. "Leukocyty", "Erytrocyty", "Glukoza", "Bilirubina", "Białko", "pH", "Ciężar właściwy"). When extracting
parameters from a urinalysis section, ALWAYS disambiguate the name by adding context:
- Dipstick (pasek diagnostyczny, results like "nie wykryto", "obecna", "prawidłowy"):
  use suffix "w moczu" or "(pasek)", e.g. "Leukocyty w moczu", "Białko w moczu", "Glukoza w moczu",
  "Bilirubina w moczu", "Azotyny w moczu", "Ciała ketonowe w moczu", "Urobilinogen w moczu",
  "Erytrocyty/Hb w moczu", "Barwa moczu", "Przejrzystość moczu", "pH moczu", "Ciężar właściwy moczu".
- Urine sediment / elementy upostaciowane (numeric values with unit "/µl"):
  use suffix "(osad moczu)", e.g. "Erytrocyty (osad moczu)", "Leukocyty (osad moczu)",
  "Komórki nabłonka płaskiego (osad moczu)", "Bakterie (osad moczu)".
NEVER emit a urine parameter under a bare blood-biomarker name. Always include the urine context word.

Return ONLY a valid JSON object in exactly this format, no markdown, no explanation:
{
  "studyDate": "YYYY-MM-DD_or_null",
  "laboratory": "string_or_null",
  "parameters": [
    { "name": "string", "value": "string", "unit": "string" }
  ]
}`;

export async function extractBloodTestResults(
  userId: string,
  fileBase64: string,
  mimeType: string
): Promise<BloodTestExtractResult> {
  const text = await callGeminiMultimodal(userId, BLOOD_TEST_EXTRACT_PROMPT, fileBase64, mimeType, {
    maxOutputTokens: 8192,
    temperature: 0.1,
  });

  let parsed: Record<string, unknown>;
  const repaired = repairTruncatedJson(text);
  try {
    parsed = JSON.parse(repaired);
  } catch {
    throw new Error(`Blood test extractor returned non-JSON: ${text.slice(0, 200)}`);
  }

  const parameters: BloodTestParameter[] = [];
  if (Array.isArray(parsed.parameters)) {
    for (const p of parsed.parameters) {
      if (!p || typeof p !== "object") continue;
      parameters.push({
        name: typeof p.name === "string" ? p.name.trim() : "Nieznany",
        value: typeof p.value === "string" ? p.value.trim() : typeof p.value === "number" ? String(p.value) : "",
        unit: typeof p.unit === "string" ? p.unit.trim() : "",
      });
    }
  }

  return {
    studyDate: typeof parsed.studyDate === "string" ? parsed.studyDate.trim() : null,
    laboratory: typeof parsed.laboratory === "string" ? parsed.laboratory.trim() : null,
    parameters,
  };
}

// ─── Imaging / Radiology test photo/PDF extractor ───────────────────────────

/**
 * Zalecenie badania kontrolnego wyczytane z opisu.
 *
 * `quote` jest OBOWIĄZKOWY — użytkownik musi widzieć, z czego wynika sugestia,
 * zamiast ufać modelowi na słowo. To zarazem zabezpieczenie przed halucynacją
 * terminu, którego w dokumencie nie ma.
 */
export interface ImagingFollowUp {
  recommended: boolean;
  /** „kontrolne USG tarczycy (płat prawy)" */
  what: string | null;
  modality: string | null;
  /** 6 — gdy lekarz pisze „za około 6 miesięcy". */
  intervalMonths: number | null;
  /** YYYY-MM-DD — gdy termin podany wprost. */
  explicitDate: string | null;
  /** DOSŁOWNY cytat z dokumentu, na którym oparta jest sugestia. */
  quote: string | null;
}

export interface ImagingReportExtractResult {
  summary: string;
  findings: string[];
  conclusion: string | null;
  bodyPart: string | null;
  modality: "RTG" | "USG" | "MRI" | "TK" | "INNE";
  studyDate: string | null;
  doctor: string | null;
  followUp: ImagingFollowUp | null;
}

const IMAGING_REPORT_PROMPT = `Przeanalizuj ten dokument/zdjęcie badania obrazowego (RTG, USG, MRI, TK).
Wyodrębnij kluczowe informacje i napisz zwięzłe polskojęzyczne podsumowanie.

Zwróć TYLKO prawidłowy JSON, bez markdown:
{
  "summary": "2-4 zdania podsumowujące najważniejsze wnioski badania",
  "findings": ["lista", "głównych", "znalezisk/obserwacji"],
  "conclusion": "końcowy wniosek / diagnoza jeśli widoczna, else null",
  "bodyPart": "badany obszar anatomiczny w mianowniku, np. tarczyca, klatka piersiowa, kolano, brzuch, else null",
  "modality": "RTG" | "USG" | "MRI" | "TK" | "INNE",
  "studyDate": "YYYY-MM-DD jeśli widoczna data badania, else null",
  "doctor": "nazwisko lekarza wykonującego/opisującego jeśli widoczne, else null",
  "followUp": {
    "recommended": true,
    "what": "krótki opis zalecanego badania kontrolnego",
    "modality": "USG" | "RTG" | "MRI" | "TK" | "BADANIE KRWI" | null,
    "intervalMonths": liczba miesięcy jeśli podano odstęp (np. 6), else null,
    "explicitDate": "YYYY-MM-DD jeśli podano konkretną datę, else null",
    "quote": "DOSŁOWNY fragment dokumentu, z którego to wynika"
  }
}

Jeśli dokument zaleca badanie kontrolne, wypełnij followUp i zacytuj DOSŁOWNIE
fragment, z którego to wynika. Jeśli nie zaleca — zwróć "followUp": null.
NIE ZGADUJ terminu, którego nie ma w dokumencie: gdy zalecenie jest bez terminu,
zostaw intervalMonths i explicitDate jako null.`;

export async function extractImagingReport(
  userId: string,
  fileBase64: string,
  mimeType: string
): Promise<ImagingReportExtractResult> {
  const text = await callGeminiMultimodal(userId, IMAGING_REPORT_PROMPT, fileBase64, mimeType, {
    maxOutputTokens: 4096,
    temperature: 0.1,
  });

  let parsed: Record<string, any>;
  const repaired = repairTruncatedJson(text);
  try {
    parsed = JSON.parse(repaired);
  } catch {
    throw new Error(`Imaging report extractor returned non-JSON: ${text.slice(0, 200)}`);
  }

  const findings: string[] = [];
  if (Array.isArray(parsed.findings)) {
    for (const f of parsed.findings) {
      if (typeof f === "string" && f.trim()) {
        findings.push(f.trim());
      }
    }
  }

  const rawModality = String(parsed.modality ?? "INNE").toUpperCase();
  const modality = ["RTG", "USG", "MRI", "TK", "INNE"].includes(rawModality)
    ? (rawModality as ImagingReportExtractResult["modality"])
    : "INNE";

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "Brak podsumowania.",
    findings,
    conclusion: typeof parsed.conclusion === "string" ? parsed.conclusion.trim() : null,
    bodyPart: typeof parsed.bodyPart === "string" ? parsed.bodyPart.trim() : null,
    modality,
    studyDate: typeof parsed.studyDate === "string" ? parsed.studyDate.trim() : null,
    doctor: typeof parsed.doctor === "string" ? parsed.doctor.trim() : null,
    followUp: parseFollowUp(parsed.followUp),
  };
}

function parseFollowUp(raw: unknown): ImagingFollowUp | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (f.recommended !== true) return null;

  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  // Odstęp musi być dodatnią liczbą miesięcy; wszystko inne traktujemy jak brak.
  const months = Number(f.intervalMonths);
  const intervalMonths =
    Number.isFinite(months) && months > 0 ? Math.round(months) : null;

  const explicit = str(f.explicitDate);
  const explicitDate =
    explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit) ? explicit : null;

  return {
    recommended: true,
    what: str(f.what),
    modality: str(f.modality),
    intervalMonths,
    explicitDate,
    quote: str(f.quote),
  };
}



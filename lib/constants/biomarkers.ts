export interface BiomarkerEntry {
  id: string;
  name: string;
  unit: string;
  normMin: number | null;
  normMax: number | null;
  /**
   * Lista akceptowalnych wartości tekstowych dla norm jakościowych
   * (np. paski moczu: "nie wykryto", "prawidłowy", "przejrzysty"). Jeśli wynik
   * tekstowy pasuje do którejkolwiek pozycji (case- i diakrytyczno-niewrażliwie),
   * status = NORMAL. W przeciwnym razie ABNORMAL.
   * Aktywne tylko gdy wartość nie jest numeryczna.
   */
  qualitativeNorm?: string[];
  category: string;
}

export const DEFAULT_BIOMARKERS: Omit<BiomarkerEntry, "id">[] = [
  // Morfologia
  { name: "Leukocyty (WBC)", unit: "tys/µl", normMin: 4.0, normMax: 10.0, category: "Morfologia" },
  { name: "Erytrocyty (RBC)", unit: "mln/µl", normMin: 4.0, normMax: 5.5, category: "Morfologia" },
  { name: "Hemoglobina (HGB)", unit: "g/dl", normMin: 12.0, normMax: 17.5, category: "Morfologia" },
  { name: "Hematokryt (HCT)", unit: "%", normMin: 36.0, normMax: 53.0, category: "Morfologia" },
  { name: "MCV", unit: "fl", normMin: 80.0, normMax: 100.0, category: "Morfologia" },
  { name: "MCH", unit: "pg", normMin: 27.0, normMax: 34.0, category: "Morfologia" },
  { name: "MCHC", unit: "g/dl", normMin: 32.0, normMax: 36.0, category: "Morfologia" },
  { name: "RDW-CV", unit: "%", normMin: 11.5, normMax: 14.5, category: "Morfologia" },
  { name: "RDW-SD", unit: "fl", normMin: 37.0, normMax: 54.0, category: "Morfologia" },
  { name: "Płytki krwi (PLT)", unit: "tys/µl", normMin: 150.0, normMax: 450.0, category: "Morfologia" },
  { name: "PDW", unit: "fl", normMin: 9.0, normMax: 17.0, category: "Morfologia" },
  { name: "MPV", unit: "fl", normMin: 9.0, normMax: 13.0, category: "Morfologia" },
  { name: "P-LCR", unit: "%", normMin: 13.0, normMax: 43.0, category: "Morfologia" },
  { name: "PCT", unit: "%", normMin: 0.17, normMax: 0.35, category: "Morfologia" },
  { name: "Neutrofile (NEUT)", unit: "tys/µl", normMin: 1.8, normMax: 7.7, category: "Morfologia" },
  { name: "Limfocyty (LYMPH)", unit: "tys/µl", normMin: 1.0, normMax: 4.5, category: "Morfologia" },
  { name: "Monocyty (MONO)", unit: "tys/µl", normMin: 0.2, normMax: 0.8, category: "Morfologia" },
  { name: "Eozynofile (EOS)", unit: "tys/µl", normMin: 0.02, normMax: 0.5, category: "Morfologia" },
  { name: "Bazofile (BASO)", unit: "tys/µl", normMin: 0.0, normMax: 0.2, category: "Morfologia" },
  { name: "Niedojrzałe granulocyty (IG)", unit: "tys/µl", normMin: 0.0, normMax: 0.03, category: "Morfologia" },
  { name: "Jądrzaste krwinki czerwone (NRBC)", unit: "tys/µl", normMin: 0.0, normMax: 0.0, category: "Morfologia" },
  
  // Wersje procentowe rozmazu krwi
  { name: "Neutrofile % (NEUT%)", unit: "%", normMin: 40.0, normMax: 70.0, category: "Morfologia" },
  { name: "Limfocyty % (LYMPH%)", unit: "%", normMin: 20.0, normMax: 45.0, category: "Morfologia" },
  { name: "Monocyty % (MONO%)", unit: "%", normMin: 2.0, normMax: 10.0, category: "Morfologia" },
  { name: "Eozynofile % (EOS%)", unit: "%", normMin: 1.0, normMax: 5.0, category: "Morfologia" },
  { name: "Bazofile % (BASO%)", unit: "%", normMin: 0.0, normMax: 2.0, category: "Morfologia" },
  { name: "Niedojrzałe granulocyty % (IG%)", unit: "%", normMin: 0.0, normMax: 0.5, category: "Morfologia" },
  { name: "Jądrzaste krwinki czerwone % (NRBC%)", unit: "%", normMin: 0.0, normMax: 0.0, category: "Morfologia" },
  
  // Lipidogram
  { name: "Cholesterol całkowity", unit: "mg/dl", normMin: 115.0, normMax: 190.0, category: "Lipidogram" },
  { name: "Cholesterol HDL", unit: "mg/dl", normMin: 40.0, normMax: 80.0, category: "Lipidogram" },
  { name: "Cholesterol LDL", unit: "mg/dl", normMin: 50.0, normMax: 115.0, category: "Lipidogram" },
  { name: "Nie-HDL cholesterol", unit: "mg/dl", normMin: 0.0, normMax: 130.0, category: "Lipidogram" },
  { name: "Trójglicerydy (TG)", unit: "mg/dl", normMin: 35.0, normMax: 150.0, category: "Lipidogram" },
  
  // Lipidogram w jednostkach molar (mmol/l)
  { name: "Cholesterol całkowity (mmol/l)", unit: "mmol/l", normMin: 3.0, normMax: 5.0, category: "Lipidogram" },
  { name: "Cholesterol HDL (mmol/l)", unit: "mmol/l", normMin: 1.0, normMax: 2.1, category: "Lipidogram" },
  { name: "Cholesterol LDL (mmol/l)", unit: "mmol/l", normMin: 1.3, normMax: 3.0, category: "Lipidogram" },
  { name: "Nie-HDL cholesterol (mmol/l)", unit: "mmol/l", normMin: 0.0, normMax: 3.4, category: "Lipidogram" },
  
  // Metabolizm
  { name: "Glukoza", unit: "mg/dl", normMin: 70.0, normMax: 99.0, category: "Metabolizm" },
  { name: "Glukoza (mmol/l)", unit: "mmol/l", normMin: 3.9, normMax: 5.5, category: "Metabolizm" },
  { name: "Insulina", unit: "µIU/ml", normMin: 2.6, normMax: 24.9, category: "Metabolizm" },
  { name: "Hemoglobina glikowana (HbA1c)", unit: "%", normMin: 4.0, normMax: 5.6, category: "Metabolizm" },
  { name: "Białko całkowite", unit: "g/dl", normMin: 6.6, normMax: 8.7, category: "Metabolizm" },
  
  // Hormony
  { name: "TSH", unit: "µIU/ml", normMin: 0.27, normMax: 4.2, category: "Hormony" },
  { name: "FT3", unit: "pg/ml", normMin: 2.0, normMax: 4.4, category: "Hormony" },
  { name: "FT4", unit: "ng/dl", normMin: 0.93, normMax: 1.7, category: "Hormony" },
  { name: "Testosteron całkowity", unit: "ng/dl", normMin: 250.0, normMax: 830.0, category: "Hormony" },
  { name: "Kortyzol (rano)", unit: "µg/dl", normMin: 6.2, normMax: 19.4, category: "Hormony" },
  
  // Wątroba
  { name: "ALT (AlAT)", unit: "U/l", normMin: 5.0, normMax: 41.0, category: "Wątroba" },
  { name: "AST (AsPAT)", unit: "U/l", normMin: 5.0, normMax: 40.0, category: "Wątroba" },
  { name: "GGTP", unit: "U/l", normMin: 5.0, normMax: 60.0, category: "Wątroba" },
  { name: "Bilirubina całkowita", unit: "mg/dl", normMin: 0.2, normMax: 1.2, category: "Wątroba" },
  { name: "Alfafosfataza (ALP)", unit: "U/l", normMin: 40.0, normMax: 130.0, category: "Wątroba" },
  
  // Nerki
  { name: "Kreatynina", unit: "mg/dl", normMin: 0.5, normMax: 1.2, category: "Nerki" },
  { name: "eGFR", unit: "ml/min/1.73m²", normMin: 90.0, normMax: null, category: "Nerki" },
  { name: "Mocznik", unit: "mg/dl", normMin: 17.0, normMax: 43.0, category: "Nerki" },
  { name: "Kwas moczowy", unit: "mg/dl", normMin: 3.5, normMax: 7.2, category: "Nerki" },
  
  // Zapalne
  { name: "CRP", unit: "mg/l", normMin: 0.0, normMax: 5.0, category: "Zapalne" },
  { name: "OB (Odczyn Biernackiego)", unit: "mm/h", normMin: 1.0, normMax: 15.0, category: "Zapalne" },
  
  // Witaminy
  { name: "Witamina D3 (25-OH)", unit: "ng/ml", normMin: 30.0, normMax: 100.0, category: "Witaminy" },
  { name: "Witamina B12", unit: "pg/ml", normMin: 197.0, normMax: 771.0, category: "Witaminy" },
  { name: "Kwas foliowy", unit: "ng/ml", normMin: 4.6, normMax: 18.7, category: "Witaminy" },
  
  // Mikroelementy
  { name: "Żelazo", unit: "µg/dl", normMin: 59.0, normMax: 158.0, category: "Mikroelementy" },
  { name: "Ferrytyna", unit: "ng/ml", normMin: 20.0, normMax: 300.0, category: "Mikroelementy" },
  { name: "Magnez", unit: "mg/dl", normMin: 1.6, normMax: 2.6, category: "Mikroelementy" },
  { name: "Sód", unit: "mmol/l", normMin: 136.0, normMax: 145.0, category: "Mikroelementy" },
  { name: "Potas", unit: "mmol/l", normMin: 3.5, normMax: 5.1, category: "Mikroelementy" },
  { name: "Wapń całkowity", unit: "mg/dl", normMin: 8.6, normMax: 10.2, category: "Mikroelementy" },
  
  // Inne / Mocz
  { name: "Ciężar właściwy moczu", unit: "g/ml", normMin: 1.005, normMax: 1.030, category: "Mocz" },
  { name: "pH moczu", unit: "", normMin: 5.0, normMax: 7.5, category: "Mocz" },

  // Mocz — pasek (badanie ogólne, jakościowe). Brak normy numerycznej; wartości tekstowe ("nie wykryto", "prawidłowy").
  { name: "Leukocyty w moczu (pasek)", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Azotyny w moczu", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Białko w moczu (pasek)", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Glukoza w moczu (pasek)", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Ciała ketonowe w moczu", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Urobilinogen w moczu", unit: "", normMin: null, normMax: null, qualitativeNorm: ["prawidłowy", "norma"], category: "Mocz" },
  { name: "Bilirubina w moczu", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Erytrocyty/Hb w moczu (pasek)", unit: "", normMin: null, normMax: null, qualitativeNorm: ["nie wykryto"], category: "Mocz" },
  { name: "Barwa moczu", unit: "", normMin: null, normMax: null, qualitativeNorm: ["żółty", "słomkowy", "słomkowo-żółty", "jasnożółty"], category: "Mocz" },
  { name: "Przejrzystość moczu", unit: "", normMin: null, normMax: null, qualitativeNorm: ["przejrzysty"], category: "Mocz" },

  // Mocz — osad / elementy upostaciowane (jednostka /µl, normy <X)
  { name: "Erytrocyty w moczu (osad)", unit: "/µl", normMin: 0.0, normMax: 14.0, category: "Mocz" },
  { name: "Leukocyty w moczu (osad)", unit: "/µl", normMin: 0.0, normMax: 13.0, category: "Mocz" },
  { name: "Komórki nabłonka płaskiego (osad)", unit: "/µl", normMin: 0.0, normMax: 6.0, category: "Mocz" },
  { name: "Bakterie w moczu (osad)", unit: "/µl", normMin: 0.0, normMax: 26.0, category: "Mocz" },

  // Inne specjalistyczne
  { name: "Lipoproteina (a)", unit: "mg/dl", normMin: 0.0, normMax: 30.0, category: "Lipidogram" },
  { name: "P-ciała p/HCV", unit: "", normMin: null, normMax: null, qualitativeNorm: ["niereaktywny", "ujemny", "negatywny"], category: "Diagnostyka infekcji" },
];

export interface BiomarkerDictEntry {
  id?: string;
  name: string;
  unit: string;
  normMin: number | null;
  normMax: number | null;
  qualitativeNorm?: string[];
  category: string;
}

/**
 * Aliasy cross-lab — surowe synonimy nazw biomarkerów używane przez różne laboratoria
 * (Synevo, Diagnostyka, ALAB) oraz formy angielskie. Klucz = kanoniczna nazwa
 * z DEFAULT_BIOMARKERS, wartość = lista alternatywnych nazw, jakimi laboratorium
 * może opisać ten sam parametr na wydruku.
 *
 * Aliasy są normalizowane (lowercase, bez polskich znaków, bez spacji/symboli)
 * w `matchBiomarker` przed porównaniem, więc tutaj można pisać naturalnie.
 */
export const BIOMARKER_ALIASES: Record<string, string[]> = {
  // Morfologia — różnice nazewnictwa Synevo vs Diagnostyka
  "Leukocyty (WBC)": ["WBC", "Krwinki białe", "Krwinki białe (WBC)", "Białe krwinki", "Leukocyty"],
  "Erytrocyty (RBC)": ["RBC", "Krwinki czerwone", "Krwinki czerwone (RBC)", "Czerwone krwinki", "Erytrocyty"],
  "Hemoglobina (HGB)": ["HGB", "Hb", "Hemoglobina"],
  "Hematokryt (HCT)": ["HCT", "Hct", "Hematokryt"],
  "Płytki krwi (PLT)": ["PLT", "Trombocyty", "Płytki", "Płytki krwi"],
  "Neutrofile (NEUT)": ["NEUT", "NEUT#", "Neutrocyty", "Liczba neutrocytów", "Liczba neutrofili", "Granulocyty obojętnochłonne"],
  "Limfocyty (LYMPH)": ["LYMPH", "LYMPH#", "Liczba limfocytów"],
  "Monocyty (MONO)": ["MONO", "MONO#", "Liczba monocytów"],
  "Eozynofile (EOS)": ["EOS", "EOS#", "Eozynocyty", "Liczba eozynocytów", "Liczba eozynofili", "Granulocyty kwasochłonne"],
  "Bazofile (BASO)": ["BASO", "BASO#", "Bazocyty", "Liczba bazocytów", "Liczba bazofili", "Granulocyty zasadochłonne"],
  "Niedojrzałe granulocyty (IG)": ["IG", "IG#", "Liczba niedojrzałych granulocytów", "Liczba niedojrzałych granulocytów (IG)"],
  "Jądrzaste krwinki czerwone (NRBC)": ["NRBC", "NRBC#", "Liczba jądrzastych krwinek czerwonych", "Liczba jądrzastych krwinek czerwonych (NRBC)"],
  "Neutrofile % (NEUT%)": ["NEUT%", "% neutrocytów", "% neutrofili", "Procent neutrocytów", "Neutrofile %", "Granulocyty obojętnochłonne %"],
  "Limfocyty % (LYMPH%)": ["LYMPH%", "% limfocytów", "Procent limfocytów", "Limfocyty %"],
  "Monocyty % (MONO%)": ["MONO%", "% monocytów", "Procent monocytów", "Monocyty %"],
  "Eozynofile % (EOS%)": ["EOS%", "% eozynocytów", "% eozynofili", "Procent eozynocytów", "Eozynofile %", "Granulocyty kwasochłonne %"],
  "Bazofile % (BASO%)": ["BASO%", "% bazocytów", "% bazofili", "Procent bazocytów", "Bazofile %", "Granulocyty zasadochłonne %"],
  "Niedojrzałe granulocyty % (IG%)": ["IG%", "% niedojrzałych granulocytów", "% niedojrzałych granulocytów (IG)", "Niedojrzałe granulocyty %"],
  "Jądrzaste krwinki czerwone % (NRBC%)": ["NRBC%", "% jądrzastych krwinek czerwonych", "% jądrzastych krwinek czerwonych (NRBC)", "Jądrzaste krwinki czerwone %"],

  // Lipidogram — kolejność słów / pisownia
  "Cholesterol całkowity": ["Cholesterol całkowity", "Cholesterol total", "TC", "Cholesterol", "Cholesterol całkowity (mg/dl)"],
  "Cholesterol całkowity (mmol/l)": ["Cholesterol całkowity", "Cholesterol total", "TC", "Cholesterol", "Cholesterol całkowity (mmol/l)", "Cholesterol total (mmol/l)"],
  "Cholesterol HDL": ["HDL", "HDL cholesterol", "HDL-C", "Cholesterol HDL", "HDL-cholesterol", "HDL cholesterol (mg/dl)"],
  "Cholesterol HDL (mmol/l)": ["HDL", "HDL cholesterol", "HDL-C", "Cholesterol HDL", "HDL-cholesterol", "HDL cholesterol (mmol/l)", "HDL (mmol/l)", "Cholesterol HDL (mmol/l)"],
  "Cholesterol LDL": ["LDL", "LDL cholesterol", "LDL-C", "Cholesterol LDL", "LDL-cholesterol", "LDL cholesterol (wartość wyliczana)", "LDL (wyliczany)", "LDL cholesterol (wartość wyliczana) (mg/dl)"],
  "Cholesterol LDL (mmol/l)": ["LDL", "LDL cholesterol", "LDL-C", "Cholesterol LDL", "LDL-cholesterol", "LDL cholesterol (wartość wyliczana)", "LDL (wyliczany)", "LDL cholesterol (wartość wyliczana) (mmol/l)", "LDL (wyliczany) (mmol/l)", "Cholesterol LDL (mmol/l)"],
  "Nie-HDL cholesterol": ["Nie-HDL cholesterol", "Non-HDL cholesterol", "Nie-HDL", "Non-HDL", "Nie-HDL cholesterol (mg/dl)", "Non-HDL cholesterol (mg/dl)"],
  "Nie-HDL cholesterol (mmol/l)": ["Nie-HDL cholesterol", "Non-HDL cholesterol", "Nie-HDL", "Non-HDL", "Nie-HDL cholesterol (mmol/l)", "Non-HDL cholesterol (mmol/l)"],
  "Trójglicerydy (TG)": ["TG", "Triglicerydy", "Trójglicerydy", "Triglycerides", "Trójglicerydy (TG)"],

  // Metabolizm
  "Glukoza": ["Glukoza", "Glucose", "Glukoza na czczo", "Glukoza (mg/dl)", "Glucose (mg/dl)"],
  "Glukoza (mmol/l)": ["Glukoza", "Glucose", "Glukoza na czczo", "Glukoza (mmol/l)", "Glucose (mmol/l)"],
  "Insulina": ["Insulina", "Insulin"],
  "Hemoglobina glikowana (HbA1c)": ["HbA1c", "Hemoglobina glikowana", "A1c"],
  "Białko całkowite": ["Białko całkowite", "Total protein", "TP"],

  // Hormony
  "TSH": ["TSH", "Tyreotropina", "Hormon tyreotropowy"],
  "FT3": ["FT3", "fT3", "Wolna trijodotyronina"],
  "FT4": ["FT4", "fT4", "Wolna tyroksyna"],
  "Testosteron całkowity": ["Testosteron", "Testosteron całkowity", "Total testosterone", "Testosterone"],
  "Kortyzol (rano)": ["Kortyzol", "Cortisol", "Kortyzol rano"],

  // Wątroba
  "ALT (AlAT)": ["ALT", "AlAT", "ALAT", "Aminotransferaza alaninowa"],
  "AST (AsPAT)": ["AST", "AsPAT", "ASPAT", "AspAT", "Aminotransferaza asparaginianowa"],
  "GGTP": ["GGTP", "GGT", "Gamma-glutamylotransferaza", "Gamma GT"],
  "Bilirubina całkowita": ["Bilirubina", "Bilirubina całkowita", "Total bilirubin"],
  "Alfafosfataza (ALP)": ["ALP", "Fosfataza alkaliczna", "Fosfataza zasadowa", "Alkaline phosphatase"],

  // Nerki
  "Kreatynina": ["Kreatynina", "Creatinine", "Kreatynina w surowicy"],
  "eGFR": ["eGFR", "GFR", "GFR wg MDRD", "GFR (MDRD)", "GFR wg CKD-EPI", "GFR (CKD-EPI)", "Filtracja kłębuszkowa"],
  "Mocznik": ["Mocznik", "Urea", "BUN"],
  "Kwas moczowy": ["Kwas moczowy", "Uric acid", "UA"],

  // Zapalne
  "CRP": ["CRP", "Białko C-reaktywne", "C-reactive protein", "hsCRP", "hs-CRP"],
  "OB (Odczyn Biernackiego)": ["OB", "Odczyn Biernackiego", "ESR", "Sedymentacja"],

  // Witaminy
  "Witamina D3 (25-OH)": ["Witamina D", "Witamina D3", "25-OH", "25-OH-D", "25(OH)D", "25(OH)D3", "25-hydroksywitamina D", "Witamina D 25(OH)", "Witamina D 25-OH", "Witamina D-25-hydroksy"],
  "Witamina B12": ["B12", "Witamina B12", "Cyjanokobalamina", "Cobalamin"],
  "Kwas foliowy": ["Kwas foliowy", "Folate", "Folian", "Folic acid"],

  // Mikroelementy
  "Żelazo": ["Żelazo", "Fe", "Iron"],
  "Ferrytyna": ["Ferrytyna", "Ferritin"],
  "Magnez": ["Magnez", "Mg", "Magnesium"],
  "Sód": ["Sód", "Na", "Sodium"],
  "Potas": ["Potas", "K", "Potassium"],
  "Wapń całkowity": ["Wapń", "Wapń całkowity", "Ca", "Calcium"],

  // Mocz
  "Ciężar właściwy moczu": ["Ciężar właściwy", "Ciężar właściwy moczu", "Specific gravity"],
  "pH moczu": ["pH", "pH moczu"],

  // Mocz — pasek diagnostyczny (jakościowy)
  "Leukocyty w moczu (pasek)": ["Leukocyty", "Leukocyty (mocz)", "Leukocyty w moczu", "Leukocytes (urine)"],
  "Azotyny w moczu": ["Azotyny", "Azotyny w moczu", "Nitrites", "NIT"],
  "Białko w moczu (pasek)": ["Białko", "Białko (mocz)", "Białko w moczu", "Protein (urine)", "PRO"],
  "Glukoza w moczu (pasek)": ["Glukoza (mocz)", "Glukoza w moczu", "Glucose (urine)", "Cukier w moczu"],
  "Ciała ketonowe w moczu": ["Ciała ketonowe", "Ketony", "Ketony w moczu", "Ketones", "KET"],
  "Urobilinogen w moczu": ["Urobilinogen", "Urobilinogen w moczu", "URO"],
  "Bilirubina w moczu": ["Bilirubina (mocz)", "Bilirubina w moczu", "Bilirubin (urine)", "BIL"],
  "Erytrocyty/Hb w moczu (pasek)": ["Erytrocyty/Hb", "Erytrocyty/Hb w moczu", "Krew w moczu", "Erytrocyty (mocz)", "Hb w moczu", "Hemoglobina w moczu"],
  "Barwa moczu": ["Barwa", "Barwa moczu", "Color (urine)"],
  "Przejrzystość moczu": ["Przejrzystość", "Przejrzystość moczu", "Clarity (urine)"],

  // Mocz — osad (elementy upostaciowane)
  "Erytrocyty w moczu (osad)": ["Erytrocyty (osad)", "Erytrocyty (osad moczu)", "Erytrocyty w osadzie moczu", "RBC (urine sediment)"],
  "Leukocyty w moczu (osad)": ["Leukocyty (osad)", "Leukocyty (osad moczu)", "Leukocyty w osadzie moczu", "WBC (urine sediment)"],
  "Komórki nabłonka płaskiego (osad)": ["Komórki nabłonka płaskiego", "Nabłonki płaskie", "Squamous epithelial cells"],
  "Bakterie w moczu (osad)": ["Bakterie", "Bakterie w moczu", "Bacteria"],

  // Specjalistyczne
  "Lipoproteina (a)": ["Lipoproteina - a", "Lipoproteina (a)", "Lp(a)", "Lipoproteina a", "Lipoprotein (a)"],
  "P-ciała p/HCV": ["P-ciała p/HCV", "anty-HCV", "Przeciwciała anty-HCV", "anti-HCV", "HCV antibodies"],
};

export function parseNumericValue(valStr: string): number {
  if (!valStr) return NaN;
  const cleaned = valStr.trim().replace(",", ".");
  // Wyodrębnia pierwszą napotkaną liczbę zmiennoprzecinkową, ignorując operatory >, <, >=, <=
  const match = cleaned.match(/([<>]=?)?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    return parseFloat(match[2]);
  }
  return parseFloat(cleaned);
}

const _removePolishDiacritics = (s: string) =>
  s.replace(/[ąĄ]/g, "a").replace(/[ćĆ]/g, "c").replace(/[ęĘ]/g, "e")
   .replace(/[łŁ]/g, "l").replace(/[ńŃ]/g, "n").replace(/[óÓ]/g, "o")
   .replace(/[śŚ]/g, "s").replace(/[źŹżŻ]/g, "z");

const _normalizeText = (s: string) =>
  _removePolishDiacritics((s ?? "").toLowerCase()).replace(/\s+/g, " ").trim();

/**
 * Sprawdza czy wartość tekstowa pasuje do którejkolwiek pozycji w normie jakościowej.
 * Porównanie jest case-insensitive i diakrytyczno-niewrażliwe (Polish-aware).
 * Wymaga ścisłego dopasowania (exact match) lub dopasowania całych słów,
 * żeby uniknąć kolizji typu "reaktywny" ⊂ "niereaktywny".
 */
export function matchesQualitativeNorm(value: string, qualitativeNorm: string[]): boolean {
  if (!value || !qualitativeNorm || qualitativeNorm.length === 0) return false;
  const v = _normalizeText(value);
  for (const expected of qualitativeNorm) {
    const e = _normalizeText(expected);
    if (!e) continue;
    if (v === e) return true;
    // Dopasowanie po granicach słów: oczekiwana fraza musi być pełnym tokenem
    // wewnątrz wartości albo wartość musi być pełnym tokenem wewnątrz frazy.
    const wordRegex = new RegExp(`(^|\\s)${e.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\s|$)`);
    if (wordRegex.test(v)) return true;
  }
  return false;
}

/**
 * Bezpieczne scalanie istniejącego słownika biomarkerów użytkownika z domyślnym.
 * Reguły:
 *  1. Brakujące pozycje (po nazwie, case-insensitive) są dodawane z DEFAULT.
 *  2. Dla istniejących pozycji uzupełniamy TYLKO te pola, których user
 *     nie ma jeszcze w swoim wpisie (np. nowe `qualitativeNorm`). Wartości,
 *     które user mógł zmienić ręcznie (`unit`, `normMin`, `normMax`,
 *     `category`, `name`), pozostają nietknięte.
 *  3. Zwracamy parę: {merged, changed}. `changed=true` oznacza, że zapis do bazy
 *     ma sens (są nowe pola lub nowe pozycje).
 */
export function mergeBiomarkersWithDefaults<
  T extends BiomarkerEntry & { id: string }
>(existing: T[], defaultsWithIds: T[]): { merged: T[]; changed: boolean } {
  let changed = false;
  const merged: T[] = existing.map(e => ({ ...e }));
  const indexByName = new Map(merged.map((b, i) => [b.name.toLowerCase().trim(), i]));

  for (const def of defaultsWithIds) {
    const key = def.name.toLowerCase().trim();
    const idx = indexByName.get(key);
    if (idx === undefined) {
      merged.push(def);
      changed = true;
      continue;
    }
    const current = merged[idx];
    // Uzupełniamy tylko brakujące pola; jeżeli user/poprzednia wersja
    // już coś tam ma, zostawiamy.
    const next = { ...current };
    let touched = false;
    if (current.qualitativeNorm === undefined && def.qualitativeNorm !== undefined) {
      next.qualitativeNorm = def.qualitativeNorm;
      touched = true;
    }
    if ((current.unit ?? null) === null && def.unit !== undefined) {
      next.unit = def.unit;
      touched = true;
    }
    if ((current.category ?? null) === null && def.category !== undefined) {
      next.category = def.category;
      touched = true;
    }
    if (touched) {
      merged[idx] = next;
      changed = true;
    }
  }

  return { merged, changed };
}

/**
 * Klasyfikuje jednostkę do jednej z fizycznych kategorii. Zwraca `null`, jeśli nie
 * potrafimy jej zaklasyfikować (np. jednostka pusta lub egzotyczna). Pozwala
 * matcherowi unikać dopasowań typu "Erytrocyty /µl" ↔ "Erytrocyty (RBC) mln/µl".
 */
function unitCategory(unit: string | undefined): string | null {
  if (!unit) return null;
  const u = unit.toLowerCase().trim();
  if (!u) return null;
  if (u === "%") return "pct";
  // Stężenia masy/objętości
  if (/(^|\b)(g|mg|µg|ug|ng|pg)\s*\/\s*(dl|l|ml)\b/.test(u)) return "mass_per_vol";
  if (/(^|\b)(mmol|µmol|umol|nmol)\s*\/\s*l\b/.test(u)) return "molar";
  if (/(^|\b)miu\/l\b|µiu\/ml|uiu\/ml/.test(u)) return "iu_per_vol";
  if (/(^|\b)u\/l\b/.test(u)) return "u_per_l";
  // Liczebności komórek/cząstek na objętość
  if (/(t\/l|mln\/(µl|ul|μl))/.test(u)) return "tera_per_l";
  if (/(g\/l|tys\/(µl|ul|μl))/.test(u)) return "giga_per_l";
  if (/^\/(µl|ul|μl)$/.test(u) || /\bna\s*µl\b/.test(u)) return "per_microliter";
  if (/mm\/h/.test(u)) return "mm_per_h";
  if (/ml\/min/.test(u)) return "egfr";
  if (/^fl$|^pg$|^mosm/.test(u)) return "single_cell";
  if (/g\/ml/.test(u)) return "density";
  return null;
}

export function matchBiomarker(
  queryName: string, 
  biomarkersList: BiomarkerDictEntry[],
  queryUnit?: string
): BiomarkerDictEntry | null {
  if (!queryName) return null;
  const query = queryName.toLowerCase().trim();

  // Określamy czy szukamy wartości procentowej
  const isQueryPct = 
    queryUnit === "%" || 
    query.includes("%") || 
    query.includes("procent");

  // Pomocnicza funkcja do wyodrębniania nazwy bazowej oraz zawartości nawiasu
  const parseName = (name: string) => {
    const lower = name.toLowerCase().trim();
    // Szukamy np. "Hemoglobina (HGB)" lub "OB (Odczyn Biernackiego)"
    const match = lower.match(/^([^(]+)(?:\(([^)]+)\))?$/);
    if (!match) return { base: lower, paren: "" };
    
    const base = match[1].trim();
    const paren = match[2] ? match[2].trim() : "";
    return { base, paren };
  };

  const removePolishDiacritics = (str: string) => {
    return str
      .replace(/[ąĄ]/g, "a")
      .replace(/[ćĆ]/g, "c")
      .replace(/[ęĘ]/g, "e")
      .replace(/[łŁ]/g, "l")
      .replace(/[ńŃ]/g, "n")
      .replace(/[óÓ]/g, "o")
      .replace(/[śŚ]/g, "s")
      .replace(/[źŹżŻ]/g, "z");
  };

  const normalizeToken = (t: string) => removePolishDiacritics(t.toLowerCase()).replace(/[^a-z0-9]/g, "");

  // Słownik synonimów rozmazu — klucze logiczne, wartości to surowe formy synonimów (znormalizowane przy porównaniu)
  const smearSynonyms: Record<string, string[]> = {
    neut: ["neut", "neutrofile", "neutrocyty", "liczbaneutrocytow", "liczbaneutrofili", "neut#", "neut%"],
    lymph: ["lymph", "limfocyty", "liczbalimfocytow", "lymph#", "lymph%"],
    mono: ["mono", "monocyty", "liczbamonocytow", "mono#", "mono%"],
    eos: ["eos", "eozynofile", "eozynocyty", "liczbaeozynocytow", "liczbaeozynofili", "eos#", "eos%"],
    baso: ["baso", "bazofile", "bazocyty", "liczbabazocytow", "liczbabazofili", "baso#", "baso%"],
    ig: ["ig", "niedojrzalegranulocyty", "niedojrzalychgranulocytow", "liczbaniedojrzalychgranulocytow", "ig#", "ig%"],
    nrbc: ["nrbc", "jadrzastekrwinkiczerwone", "jadrzastychkrwinekczerwonych", "liczbajadrzastychkrwinekczerwonych", "nrbc#", "nrbc%"],
  };

  // Sprawdza, do której kategorii rozmazu należy dany ZNORMALIZOWANY token (qNorm lub bNameNorm)
  const checkSmearMapping = (normalized: string): string | null => {
    if (!normalized) return null;
    for (const [key, synonyms] of Object.entries(smearSynonyms)) {
      for (const s of synonyms) {
        const sNorm = normalizeToken(s);
        if (!sNorm) continue;
        // Pełne dopasowanie tokenu lub jako podciąg (oba kierunki).
        // Wymagamy >=3 znaków przy podciągu, żeby uniknąć kolizji "ig" z innymi nazwami.
        if (normalized === sNorm) return key;
        if (sNorm.length >= 4 && normalized.includes(sNorm)) return key;
      }
    }
    return null;
  };

  const qNorm = normalizeToken(query);
  const querySmearKey = checkSmearMapping(qNorm);

  // Funkcja oceniająca dopasowanie pod kątem zgodności jednostki / procentowości
  const scoreMatch = (b: BiomarkerDictEntry): number => {
    const bName = b.name.toLowerCase();
    const isBPct = b.unit === "%" || bName.includes("%");
    let score = 0;

    // Zgodność procentowości
    if (isQueryPct === isBPct) {
      score += 100;
    }

    // Bonus za zgodny kontekst "mocz" — jeśli jedno ma w nazwie wzmiankę o moczu, drugie też powinno.
    const queryIsUrine = /mocz|urine|osad|pasek/.test(query);
    const candidateIsUrine = /mocz|urine|osad|pasek/.test(bName) || b.category.toLowerCase() === "mocz";
    if (queryIsUrine && candidateIsUrine) {
      score += 200;
    } else if (queryIsUrine !== candidateIsUrine) {
      // Silna kara, gdy jeden jest "moczowy" a drugi nie — to gwarantuje, że
      // "Bilirubina w moczu" nie trafi w "Bilirubina całkowita" (krew).
      score -= 500;
    }

    // Penalizacja za niekompatybilne kategorie jednostek (np. /µl vs mln/µl vs mg/dl).
    // Tylko gdy obie strony mają jakąś jednostkę i daje się ją sklasyfikować.
    if (queryUnit && b.unit) {
      const qCat = unitCategory(queryUnit);
      const bCat = unitCategory(b.unit);
      if (qCat && bCat && qCat !== bCat) {
        score -= 300;
      } else if (qCat && bCat && qCat === bCat) {
        score += 30;
      }
    }

    return score;
  };

  // Zbieramy kandydatów
  const candidates: { entry: BiomarkerDictEntry; score: number }[] = [];

  for (const b of biomarkersList) {
    const parsedB = parseName(b.name);
    const bNameNorm = normalizeToken(b.name);
    const bBaseNorm = normalizeToken(parsedB.base);
    const bParenNorm = parsedB.paren ? normalizeToken(parsedB.paren) : "";

    let matchType: "exact" | "partial" | "none" = "none";

    // 1. Dokładne dopasowanie całej nazwy / nazwy bazowej / skrótu w nawiasie
    if (qNorm === bNameNorm || qNorm === bBaseNorm || (bParenNorm && qNorm === bParenNorm)) {
      matchType = "exact";
    }
    // 2. Dopasowanie przez specyficzny klucz rozmazu (oba ZNORMALIZOWANE)
    else if (querySmearKey) {
      const bSmearKey = checkSmearMapping(bNameNorm);
      if (bSmearKey === querySmearKey) {
        matchType = "exact";
      }
    }

    // 3. Aliasy cross-lab (Synevo / Diagnostyka / ALAB) — pełna lista poniżej
    if (matchType === "none") {
      const aliases = BIOMARKER_ALIASES[b.name];
      if (aliases) {
        for (const alias of aliases) {
          const aliasNorm = normalizeToken(alias);
          if (!aliasNorm) continue;
          if (qNorm === aliasNorm) {
            matchType = "exact";
            break;
          }
          // Dopasowanie częściowe: zarówno alias, jak i query muszą mieć ≥4 znaki
          // i jeden musi być prefiksem drugiego, żeby uniknąć kolizji typu "ph" w "lymph".
          if (
            aliasNorm.length >= 4 &&
            qNorm.length >= 4 &&
            (qNorm.startsWith(aliasNorm) || aliasNorm.startsWith(qNorm))
          ) {
            matchType = "partial";
          }
        }
      }
    }

    // 4. Tolerancyjne dopasowanie po prefiksie nazwy bazowej / skrótu
    if (matchType === "none") {
      if (
        bBaseNorm.startsWith(qNorm) ||
        qNorm.startsWith(bBaseNorm) ||
        (bParenNorm && (bParenNorm.startsWith(qNorm) || qNorm.startsWith(bParenNorm)))
      ) {
        if (qNorm.length >= 3) {
          matchType = "partial";
        }
      }
    }

    if (matchType !== "none") {
      let score = scoreMatch(b);
      if (matchType === "exact") score += 50;
      else if (matchType === "partial") score += 10;
      candidates.push({ entry: b, score });
    }
  }

  if (candidates.length > 0) {
    // Sortujemy od najwyższego wyniku dopasowania
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].entry;
  }

  return null;
}

export function getDefaultBiomarkersWithIds() {
  return DEFAULT_BIOMARKERS.map((b, index) => ({
    ...b,
    id: `default_${b.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${index}`,
  }));
}

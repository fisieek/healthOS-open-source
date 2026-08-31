"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save, Plus, Trash2, HelpCircle, ArrowUp, ArrowDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { matchBiomarker, parseNumericValue, matchesQualitativeNorm, BiomarkerDictEntry } from "@/lib/constants/biomarkers";

interface ExtractedParameter {
  name: string;
  value: string;
  unit: string;
}

export interface BloodTestReviewFormProps {
  intakeId: string;
  defaultDate?: string;
  extracted: {
    studyDate?: string | null;
    laboratory?: string | null;
    parameters?: ExtractedParameter[];
  };
  sourceLabel: string | null;
  documentDate: string | null;
  onSaved: (info: { targetId: string; targetUrl?: string }) => void;
  onReclassify: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BloodTestReviewForm({
  intakeId,
  defaultDate,
  extracted,
  sourceLabel,
  documentDate,
  onSaved,
  onReclassify,
}: BloodTestReviewFormProps) {
  // Słownik biomarkerów pobrany z API
  const [dict, setDict] = useState<BiomarkerDictEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(true);

  // Stan pól dokumentu
  const [title, setTitle] = useState("Wyniki badań laboratoryjnych");
  const [docType, setDocType] = useState("BLOOD_TEST");
  const [studyDate, setStudyDate] = useState(extracted.studyDate || documentDate || defaultDate || todayIso());
  const [laboratory, setLaboratory] = useState(extracted.laboratory || sourceLabel || "");
  const [doctor, setDoctor] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  
  // Stan listy parametrów
  const [parameters, setParameters] = useState<ExtractedParameter[]>(() => {
    return extracted.parameters || [];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobranie słownika biomarkerów użytkownika
  useEffect(() => {
    async function loadBiomarkers() {
      try {
        const res = await fetch("/api/settings/biomarkers");
        if (res.ok) {
          const data = await res.json();
          setDict(data);
        }
      } catch (err) {
        console.error("Failed to load biomarkers dict", err);
      } finally {
        setDictLoading(false);
      }
    }
    void loadBiomarkers();
  }, []);

  // Dopasowanie kategorii i norm do nazwy parametru (z uwzględnieniem jednostki)
  const getBiomarkerInfo = (name: string, unit?: string) => {
    return matchBiomarker(name, dict, unit);
  };

  // Obliczenie statusu w stosunku do norm referencyjnych
  const getParameterStatus = (name: string, valStr: string, unit?: string) => {
    const info = getBiomarkerInfo(name, unit);
    if (!info) return { status: "UNKNOWN", text: "Brak w słowniku", normStr: "—" };

    // parseNumericValue obsługuje operatory porównania, np. ">90" -> 90, "<0.6" -> 0.6
    const val = parseNumericValue(valStr);

    // Wartość nieliczbowa — sprawdzamy normę jakościową, jeśli istnieje
    if (isNaN(val)) {
      if (info.qualitativeNorm && info.qualitativeNorm.length > 0) {
        const ok = matchesQualitativeNorm(valStr, info.qualitativeNorm);
        return {
          status: ok ? "NORMAL" : "ABNORMAL",
          text: ok ? "Norma" : "Odchylenie",
          normStr: getNormStr(info),
        };
      }
      return { status: "NOT_NUMERIC", text: "Tekst", normStr: getNormStr(info) };
    }

    const min = info.normMin;
    const max = info.normMax;

    let status: "NORMAL" | "HIGH" | "LOW" = "NORMAL";
    if (min !== null && val < min) status = "LOW";
    else if (max !== null && val > max) status = "HIGH";

    const text = status === "NORMAL" ? "W normie" : status === "HIGH" ? "Za Wysoko" : "Za Nisko";
    return { status, text, normStr: getNormStr(info) };
  };

  const getNormStr = (info: BiomarkerDictEntry) => {
    if (info.normMin !== null && info.normMax !== null) {
      return `${info.normMin} - ${info.normMax} ${info.unit}`;
    }
    if (info.normMin !== null) return `>= ${info.normMin} ${info.unit}`;
    if (info.normMax !== null) return `<= ${info.normMax} ${info.unit}`;
    if (info.qualitativeNorm && info.qualitativeNorm.length > 0) {
      // Pierwszy z listy traktujemy jako kanoniczny tekst normy
      return info.qualitativeNorm[0];
    }
    return "brak normy";
  };

  function updateRow(index: number, field: keyof ExtractedParameter, value: string) {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  }

  function addRow() {
    setParameters([...parameters, { name: "", value: "", unit: "" }]);
  }

  function removeRow(index: number) {
    setParameters(parameters.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const formattedParams: Record<string, { value: string; unit?: string }> = {};
      for (const p of parameters) {
        if (p.name.trim() && p.value.trim()) {
          let key = p.name.trim();
          // Dezambiguacja przy kolizji nazw (np. AI wyekstrahowało dwie pozycje
          // "Neutrofile" — jedną z jednostką "G/l" i drugą z "%"). Dopisujemy jednostkę
          // do klucza, żeby uniknąć nadpisania jednego z wariantów w Record<string, ...>.
          if (formattedParams[key]) {
            const unitSuffix = p.unit.trim();
            if (unitSuffix) {
              key = `${key} [${unitSuffix}]`;
              // Gdyby i ta nazwa się powtórzyła, dorzucamy licznik
              let i = 2;
              while (formattedParams[key]) {
                key = `${p.name.trim()} [${unitSuffix}] (${i})`;
                i++;
              }
            } else {
              let i = 2;
              while (formattedParams[key]) {
                key = `${p.name.trim()} (${i})`;
                i++;
              }
            }
          }
          formattedParams[key] = {
            value: p.value.trim(),
            ...(p.unit.trim() ? { unit: p.unit.trim() } : {}),
          };
        }
      }

      // Generuj automatyczne tagi na podstawie biomarkerów lub typu
      const computedTags = [...tags];
      if (docType === "BLOOD_TEST" && !computedTags.includes("krew")) computedTags.push("krew");
      if (docType === "URINE_TEST" && !computedTags.includes("mocz")) computedTags.push("mocz");

      const payload = {
        title: title.trim(),
        type: docType,
        studyDate,
        laboratory: laboratory.trim() || null,
        doctor: doctor.trim() || null,
        description: description.trim() || null,
        tags: computedTags,
        parameters: formattedParams,
      };

      const res = await fetch(`/api/intake/${intakeId}/save-blood`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved({ targetId: data.documentId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zapis nie powiódł się");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 rounded-xl border border-[#2e3229] bg-[#141511]">
      <div className="flex items-center justify-between border-b border-[#2e3229] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#f1f2ec]">
            Weryfikacja parametrów badania
          </h3>
          <p className="text-[11px] text-[#8c9282] mt-0.5">
            Sprawdź i skoryguj wyekstrahowane dane przed zapisem do profilu zdrowotnego.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="text-[#8c9282] hover:text-[#bce663] hover:bg-[#1a1c18] text-xs" type="button" onClick={onReclassify}>
          Analizuj ponownie
        </Button>
      </div>

      {/* Metadane dokumentu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">
            Tytuł badania
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
            placeholder="np. Morfologia krwi"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">
            Typ badania
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
          >
            <option value="BLOOD_TEST">Badanie krwi (Morfologia)</option>
            <option value="HORMONES">Badania hormonalne</option>
            <option value="URINE_TEST">Badanie moczu</option>
            <option value="OTHER">Inne badanie laboratoryjne</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">
            Data badania
          </label>
          <input
            type="date"
            value={studyDate}
            onChange={(e) => setStudyDate(e.target.value)}
            className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">
            Laboratorium
          </label>
          <input
            type="text"
            value={laboratory}
            onChange={(e) => setLaboratory(e.target.value)}
            placeholder="np. Diagnostyka, Synevo"
            className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">
            Lekarz zlecający (opcjonalnie)
          </label>
          <input
            type="text"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="np. dr Kowalski"
            className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282]">
            Opis / Uwagi
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Krótki komentarz do badania"
            className="w-full h-9 rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 text-xs text-[#f1f2ec] focus:outline-none focus:border-[#bce663]"
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-[11px] uppercase font-bold tracking-wider text-[#8c9282]">
            Wyekstrahowane biomarkery ({parameters.length})
          </h4>
        </div>

        {/* Tabela parametrów */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {parameters.length === 0 ? (
            <p className="text-xs text-[#8c9282] py-6 text-center border border-dashed border-[#2e3229] rounded-lg">
              Brak wyekstrahowanych parametrów. Dodaj wiersze ręcznie za pomocą przycisku poniżej.
            </p>
          ) : (
            parameters.map((p, idx) => {
              const check = getParameterStatus(p.name, p.value, p.unit);
              const info = getBiomarkerInfo(p.name, p.unit);
              
              return (
                <div
                  key={idx}
                  className={`flex flex-col sm:flex-row gap-2 items-start sm:items-center p-2 rounded-lg border transition-colors ${
                    check.status === "HIGH" || check.status === "ABNORMAL"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : check.status === "LOW"
                      ? "border-sky-500/30 bg-sky-500/5"
                      : "border-[#2e3229] bg-[#0d0e0c]"
                  }`}
                >
                  {/* Nazwa */}
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateRow(idx, "name", e.target.value)}
                    placeholder="Nazwa (np. Hemoglobina)"
                    className="h-8 rounded-md border border-[#2e3229] bg-[#1a1c18] px-3 text-xs text-[#f1f2ec] w-full sm:flex-1 min-w-[160px] focus:outline-none focus:border-[#bce663]"
                  />

                  {/* Wartość */}
                  <input
                    type="text"
                    value={p.value}
                    onChange={(e) => updateRow(idx, "value", e.target.value)}
                    placeholder="Wartość"
                    className="h-8 rounded-md border border-[#2e3229] bg-[#1a1c18] px-3 text-xs text-[#f1f2ec] w-24 focus:outline-none focus:border-[#bce663] text-center font-mono font-bold"
                  />

                  {/* Jednostka */}
                  <input
                    type="text"
                    value={p.unit}
                    onChange={(e) => updateRow(idx, "unit", e.target.value)}
                    placeholder="Jednostka"
                    className="h-8 rounded-md border border-[#2e3229] bg-[#1a1c18] px-2 text-xs text-[#8c9282] w-20 focus:outline-none focus:border-[#bce663] text-center font-mono"
                  />

                  {/* Weryfikacja norm (Tylko na desktopie, na mobilkach ukrywamy lub upraszczamy) */}
                  <div className="flex items-center gap-2 w-full sm:w-44 px-1 justify-between sm:justify-start">
                    <span className="text-[10px] text-[#8c9282] truncate max-w-[120px]">
                      Norma: {check.normStr}
                    </span>

                    {/* Status Badge */}
                    {check.status === "HIGH" && (
                      <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] px-1.5 py-0">
                        <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> Za Wysoko
                      </Badge>
                    )}
                    {check.status === "LOW" && (
                      <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] px-1.5 py-0">
                        <ArrowDown className="h-2.5 w-2.5 mr-0.5" /> Za Nisko
                      </Badge>
                    )}
                    {check.status === "NORMAL" && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] px-1.5 py-0">
                        <Check className="h-2.5 w-2.5 mr-0.5" /> Norma
                      </Badge>
                    )}
                    {check.status === "ABNORMAL" && (
                      <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] px-1.5 py-0">
                        <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> Odchylenie
                      </Badge>
                    )}
                  </div>

                  {/* Usuń wiersz */}
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="text-[#5d6050] hover:text-rose-400 p-1 rounded hover:bg-[#1a1c18] self-end sm:self-auto transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Dodaj parametr */}
        <button
          type="button"
          onClick={addRow}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[#bce663] hover:underline pt-1"
        >
          <Plus className="h-3.5 w-3.5" /> Dodaj parametr ręcznie
        </button>
      </div>

      {error && <p className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 p-2.5 rounded-lg font-medium">{error}</p>}

      {/* Przyciski operacyjne */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#2e3229]">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || dictLoading}
          className="rounded-xl bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Zapisywanie..." : "Zapisz wyniki"}
        </Button>
      </div>
    </div>
  );
}

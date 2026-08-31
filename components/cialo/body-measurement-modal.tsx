"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface BodyMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface ExtractedComposition {
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
  // Nowe wskaźniki
  waterMass: number | null;
  fatMass: number | null;
  proteinMass: number | null;
  musclePct: number | null;
  bonePct: number | null;
  skeletalMuscleMass: number | null;
  waistToHipRatio: number | null;
}

type Tab = "photo" | "manual";

export default function BodyMeasurementModal({ isOpen, onClose, onSaved }: BodyMeasurementModalProps) {
  const [tab, setTab] = useState<Tab>("photo");

  // Prevent browser from opening dragged images in a new tab when dropping
  useEffect(() => {
    if (!isOpen) return;
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, [isOpen]);

  // Photo upload
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ExtractedComposition | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const array = Array.from(newFiles);
    const validFiles = array.filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (validFiles.length === 0) {
      setError("Dozwolone są pliki graficzne (PNG, JPG) lub PDF.");
      return;
    }

    setFiles((prev) => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 5) {
        setError("Możesz dodać maksymalnie 5 plików.");
        return combined.slice(0, 5);
      }
      setError(null);
      return combined;
    });
  };

  const handleRemoveFile = (idx: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        setPreview(null);
      }
      return next;
    });
  };

  // Common
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Manual fields
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [thigh, setThigh] = useState("");
  const [bicep, setBicep] = useState("");
  const [calf, setCalf] = useState("");
  const [shoulder, setShoulder] = useState("");

  // Dodatkowe wskaźniki z wagi inteligentnej (ręczne)
  const [bmi, setBmi] = useState("");
  const [leanBodyMass, setLeanBodyMass] = useState("");
  const [boneMass, setBoneMass] = useState("");
  const [bodyWaterPct, setBodyWaterPct] = useState("");
  const [proteinPct, setProteinPct] = useState("");
  const [visceralFat, setVisceralFat] = useState("");
  const [basalMetabolism, setBasalMetabolism] = useState("");
  const [metabolicAge, setMetabolicAge] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [bodyScore, setBodyScore] = useState("");
  const [idealWeight, setIdealWeight] = useState("");
  const [skeletalMusclePct, setSkeletalMusclePct] = useState("");
  const [waterMass, setWaterMass] = useState("");
  const [fatMass, setFatMass] = useState("");
  const [proteinMass, setProteinMass] = useState("");
  const [musclePct, setMusclePct] = useState("");
  const [bonePct, setBonePct] = useState("");
  const [skeletalMuscleMass, setSkeletalMuscleMass] = useState("");
  const [waistToHipRatio, setWaistToHipRatio] = useState("");

  const reset = () => {
    setTab("photo");
    setFiles([]);
    setIsDragging(false);
    setPreview(null);
    setError(null);
    setSaved(false);
    setDate(new Date().toISOString().split("T")[0]);
    setWeight(""); setBodyFat(""); setMuscleMass("");
    setWaist(""); setChest(""); setHips("");
    setThigh(""); setBicep(""); setCalf(""); setShoulder("");
    
    // Reset zaawansowanych
    setBmi(""); setLeanBodyMass(""); setBoneMass(""); setBodyWaterPct("");
    setProteinPct(""); setVisceralFat(""); setBasalMetabolism(""); setMetabolicAge("");
    setBodyType(""); setBodyScore(""); setIdealWeight(""); setSkeletalMusclePct("");
    setWaterMass(""); setFatMass(""); setProteinMass(""); setMusclePct("");
    setBonePct(""); setSkeletalMuscleMass(""); setWaistToHipRatio("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      files.forEach((f) => {
        form.append("files", f);
      });
      const res = await fetch("/api/log/body/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd analizy");
      setPreview(json.data);
      
      // Wstępnie wypełnij pola po analizie zdjęcia
      if (json.data.weight) setWeight(json.data.weight.toString());
      if (json.data.bodyFat) setBodyFat(json.data.bodyFat.toString());
      if (json.data.muscleMass) setMuscleMass(json.data.muscleMass.toString());
      if (json.data.bmi) setBmi(json.data.bmi.toString());
      if (json.data.leanBodyMass) setLeanBodyMass(json.data.leanBodyMass.toString());
      if (json.data.boneMass) setBoneMass(json.data.boneMass.toString());
      if (json.data.bodyWaterPct) setBodyWaterPct(json.data.bodyWaterPct.toString());
      if (json.data.proteinPct) setProteinPct(json.data.proteinPct.toString());
      if (json.data.visceralFat) setVisceralFat(json.data.visceralFat.toString());
      if (json.data.basalMetabolism) setBasalMetabolism(json.data.basalMetabolism.toString());
      if (json.data.metabolicAge) setMetabolicAge(json.data.metabolicAge.toString());
      if (json.data.bodyType) setBodyType(json.data.bodyType.toString());
      if (json.data.bodyScore) setBodyScore(json.data.bodyScore.toString());
      if (json.data.idealWeight) setIdealWeight(json.data.idealWeight.toString());
      if (json.data.skeletalMusclePct) setSkeletalMusclePct(json.data.skeletalMusclePct.toString());
      if (json.data.waterMass) setWaterMass(json.data.waterMass.toString());
      if (json.data.fatMass) setFatMass(json.data.fatMass.toString());
      if (json.data.proteinMass) setProteinMass(json.data.proteinMass.toString());
      if (json.data.musclePct) setMusclePct(json.data.musclePct.toString());
      if (json.data.bonePct) setBonePct(json.data.bonePct.toString());
      if (json.data.skeletalMuscleMass) setSkeletalMuscleMass(json.data.skeletalMuscleMass.toString());
      if (json.data.waistToHipRatio) setWaistToHipRatio(json.data.waistToHipRatio.toString());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSavePhoto = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/log/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          weight: preview.weight,
          bodyFat: preview.bodyFat,
          muscleMass: preview.muscleMass,
          bmi: preview.bmi,
          leanBodyMass: preview.leanBodyMass,
          boneMass: preview.boneMass,
          bodyWaterPct: preview.bodyWaterPct,
          proteinPct: preview.proteinPct,
          visceralFat: preview.visceralFat,
          basalMetabolism: preview.basalMetabolism,
          metabolicAge: preview.metabolicAge,
          bodyType: preview.bodyType,
          bodyScore: preview.bodyScore,
          idealWeight: preview.idealWeight,
          skeletalMusclePct: preview.skeletalMusclePct,
          sourceLabel: preview.sourceLabel,
          source: "PHOTO",
          // Nowe pola
          waterMass: preview.waterMass,
          fatMass: preview.fatMass,
          proteinMass: preview.proteinMass,
          musclePct: preview.musclePct,
          bonePct: preview.bonePct,
          skeletalMuscleMass: preview.skeletalMuscleMass,
          waistToHipRatio: preview.waistToHipRatio,
          // Obwody manualne (z formularza, opcjonalnie)
          waist: waist || undefined,
          chest: chest || undefined,
          hips: hips || undefined,
          thigh: thigh || undefined,
          bicep: bicep || undefined,
          calf: calf || undefined,
          shoulder: shoulder || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Błąd zapisu");
      }
      setSaved(true);
      setTimeout(() => { handleClose(); onSaved(); }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveManual = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/log/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          weight: weight || undefined,
          bodyFat: bodyFat || undefined,
          muscleMass: muscleMass || undefined,
          waist: waist || undefined,
          chest: chest || undefined,
          hips: hips || undefined,
          thigh: thigh || undefined,
          bicep: bicep || undefined,
          calf: calf || undefined,
          shoulder: shoulder || undefined,
          // Dodatkowe wskaźniki manualne
          bmi: bmi || undefined,
          leanBodyMass: leanBodyMass || undefined,
          boneMass: boneMass || undefined,
          bodyWaterPct: bodyWaterPct || undefined,
          proteinPct: proteinPct || undefined,
          visceralFat: visceralFat || undefined,
          basalMetabolism: basalMetabolism || undefined,
          metabolicAge: metabolicAge || undefined,
          bodyType: bodyType || undefined,
          bodyScore: bodyScore || undefined,
          idealWeight: idealWeight || undefined,
          skeletalMusclePct: skeletalMusclePct || undefined,
          waterMass: waterMass || undefined,
          fatMass: fatMass || undefined,
          proteinMass: proteinMass || undefined,
          musclePct: musclePct || undefined,
          bonePct: bonePct || undefined,
          skeletalMuscleMass: skeletalMuscleMass || undefined,
          waistToHipRatio: waistToHipRatio || undefined,
          source: "MANUAL",
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Błąd zapisu");
      }
      setSaved(true);
      setTimeout(() => { handleClose(); onSaved(); }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Dodaj nowy pomiar"
      description="Wgraj zdjęcie lub PDF raportu z wagi inteligentnej, albo wpisz dane ręcznie."
      size="xl"
    >
      {saved ? (
        <div className="py-8 text-center space-y-2">
          <div className="text-4xl">✓</div>
          <p className="text-sm font-bold text-[#bce663]">Pomiar zapisany!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex bg-[#141511] p-1 rounded-xl border border-[#2b2d24]">
            <button
              onClick={() => setTab("photo")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "photo" ? "bg-[#bce663] text-[#0d0e0c]" : "text-[#8e9182] hover:text-white"
              }`}
            >
              📸 Zdjęcie z wagi
            </button>
            <button
              onClick={() => setTab("manual")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                tab === "manual" ? "bg-[#bce663] text-[#0d0e0c]" : "text-[#8e9182] hover:text-white"
              }`}
            >
              ✏️ Wpis ręczny
            </button>
          </div>

          {/* Wspólne pole: data */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Data pomiaru</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* TAB: PHOTO */}
          {tab === "photo" && (
            <div className="space-y-4">
              {/* Jeden wspólny, ukryty input — wyzwalany z obu stref poniżej */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files) handleFilesAdded(e.target.files);
                  // Reset, by można było wybrać ten sam plik ponownie po usunięciu
                  e.target.value = "";
                }}
              />

              {files.length === 0 ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) {
                      handleFilesAdded(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
                    isDragging
                      ? "border-[#bce663] bg-[#bce663]/5 scale-[1.01] shadow-[0_0_25px_rgba(188,230,99,0.15)]"
                      : "border-[#2b2d24] bg-[#141511] hover:border-[#bce663]/50"
                  }`}
                >
                  <Upload className={`h-8 w-8 transition-colors ${isDragging ? "text-[#bce663]" : "text-[#5d6050]"}`} />
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">Przeciągnij pliki lub kliknij</p>
                    <p className="text-xs text-[#8e9182] mt-1">Dodaj do 5 plików raportu z wagi (PNG, JPG, PDF)</p>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) {
                      handleFilesAdded(e.dataTransfer.files);
                    }
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">
                      Wybrane pliki ({files.length}/5)
                    </p>
                    {files.length < 5 && (
                      <span className="text-[10px] text-[#8e9182]">
                        Możesz upuścić kolejne pliki tutaj
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-xl border border-[#2b2d24] bg-[#141511] hover:border-[#bce663]/30 transition-all group"
                      >
                        <span className="text-base select-none">{file.type === "application/pdf" ? "📄" : "📸"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{file.name}</p>
                          <p className="text-[10px] text-[#8e9182]">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 rounded-lg text-[#8e9182] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-80 group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {files.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-3 cursor-pointer transition-all ${
                        isDragging
                          ? "border-[#bce663] bg-[#bce663]/5 scale-[1.01]"
                          : "border-[#2b2d24] bg-[#141511] hover:border-[#bce663]/50 hover:bg-[#181a14]"
                      }`}
                    >
                      <Upload className="h-4 w-4 text-[#5d6050]" />
                      <span className="text-xs font-medium text-[#8e9182] hover:text-white">Dodaj kolejny plik...</span>
                    </button>
                  )}
                </div>
              )}

              {preview && (
                <div className="rounded-xl border border-[#2b2d24] bg-[#141511] p-4 space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#bce663] sticky top-0 bg-[#141511] py-1 border-b border-[#2b2d24]/50 mb-2 z-10">
                    Wyekstrahowane dane {preview.sourceLabel && `· ${preview.sourceLabel}`}
                  </p>
                  
                  {/* Sekcja 1: Główne wskaźniki */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182]">Główne wskaźniki</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {[
                        ["Waga", preview.weight ? `${preview.weight} kg` : null],
                        ["BMI", preview.bmi ?? null],
                        ["Wynik ciała", preview.bodyScore ? `${preview.bodyScore}/100` : null],
                        ["Sylwetka", preview.bodyType ?? null],
                        ["Wiek metaboliczny", preview.metabolicAge ? `${preview.metabolicAge} lat` : null],
                        ["BMR", preview.basalMetabolism ? `${preview.basalMetabolism} kcal` : null],
                        ["Tłuszcz trzewny", preview.visceralFat ?? null],
                        ["Idealna waga", preview.idealWeight ? `${preview.idealWeight} kg` : null],
                      ].filter(([_, v]) => v !== null).map(([label, val]) => (
                        <div key={label} className="bg-[#1a1c18] rounded-lg p-2 border border-[#2b2d24]/30">
                          <p className="text-[8px] text-[#8e9182] uppercase font-bold">{label}</p>
                          <p className="font-bold text-white mt-0.5 truncate">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sekcja 2: Masy składników */}
                  {([preview.muscleMass, preview.waterMass, preview.fatMass, preview.proteinMass, preview.boneMass, preview.leanBodyMass, preview.skeletalMuscleMass].some(v => v !== null)) && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182]">Masy składników (kg)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {[
                          ["Masa mięśni", preview.muscleMass ? `${preview.muscleMass} kg` : null],
                          ["Masa wody", preview.waterMass ? `${preview.waterMass} kg` : null],
                          ["Masa tłuszczu", preview.fatMass ? `${preview.fatMass} kg` : null],
                          ["Masa białka", preview.proteinMass ? `${preview.proteinMass} kg` : null],
                          ["Masa kości", preview.boneMass ? `${preview.boneMass} kg` : null],
                          ["Masa bez tłuszczu", preview.leanBodyMass ? `${preview.leanBodyMass} kg` : null],
                          ["Mięśnie szkieletowe", preview.skeletalMuscleMass ? `${preview.skeletalMuscleMass} kg` : null],
                        ].filter(([_, v]) => v !== null).map(([label, val]) => (
                          <div key={label} className="bg-[#1a1c18] rounded-lg p-2 border border-[#2b2d24]/30">
                            <p className="text-[8px] text-[#8e9182] uppercase font-bold">{label}</p>
                            <p className="font-bold text-white mt-0.5 truncate">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sekcja 3: Udziały procentowe */}
                  {([preview.bodyFat, preview.bodyWaterPct, preview.proteinPct, preview.musclePct, preview.bonePct, preview.skeletalMusclePct].some(v => v !== null)) && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182]">Udziały procentowe (%)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {[
                          ["Tłuszcz %", preview.bodyFat ? `${preview.bodyFat}%` : null],
                          ["Woda %", preview.bodyWaterPct ? `${preview.bodyWaterPct}%` : null],
                          ["Białko %", preview.proteinPct ? `${preview.proteinPct}%` : null],
                          ["Mięśnie %", preview.musclePct ? `${preview.musclePct}%` : null],
                          ["Minerały kości %", preview.bonePct ? `${preview.bonePct}%` : null],
                          ["Mięśnie szkielet. %", preview.skeletalMusclePct ? `${preview.skeletalMusclePct}%` : null],
                        ].filter(([_, v]) => v !== null).map(([label, val]) => (
                          <div key={label} className="bg-[#1a1c18] rounded-lg p-2 border border-[#2b2d24]/30">
                            <p className="text-[8px] text-[#8e9182] uppercase font-bold">{label}</p>
                            <p className="font-bold text-white mt-0.5 truncate">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sekcja 4: Zaawansowane */}
                  {preview.waistToHipRatio !== null && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#8e9182]">Analiza proporcji</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-[#1a1c18] rounded-lg p-2 border border-[#2b2d24]/30">
                          <p className="text-[8px] text-[#8e9182] uppercase font-bold">Wskaźnik WHR</p>
                          <p className="font-bold text-white mt-0.5">{preview.waistToHipRatio}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Opcjonalne obwody przy uploadu zdjęcia */}
              {preview && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-bold text-[#8e9182] hover:text-white py-2 select-none">
                    + Dodaj obwody ciała (opcjonalnie)
                  </summary>
                  <CircumferenceFields
                    waist={waist} setWaist={setWaist}
                    chest={chest} setChest={setChest}
                    hips={hips} setHips={setHips}
                    thigh={thigh} setThigh={setThigh}
                    bicep={bicep} setBicep={setBicep}
                    calf={calf} setCalf={setCalf}
                    shoulder={shoulder} setShoulder={setShoulder}
                  />
                </details>
              )}

              <div className="flex gap-3">
                {!preview ? (
                  <button
                    onClick={handleAnalyze}
                    disabled={files.length === 0 || analyzing}
                    className="flex-1 rounded-xl bg-[#bce663] py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
                  >
                    {analyzing
                      ? "Analizuję..."
                      : files.length > 1
                        ? `Analizuj ${files.length} ${files.length < 5 ? "pliki" : "plików"}`
                        : "Analizuj plik"
                    }
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setPreview(null); setFiles([]); }}
                      className="flex-1 rounded-xl border border-[#2b2d24] py-2.5 text-xs font-bold text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-all"
                    >
                      Wgraj inne
                    </button>
                    <button
                      onClick={handleSavePhoto}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-[#bce663] py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
                    >
                      {saving ? "Zapisuję..." : "Zapisz pomiar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB: MANUAL */}
          {/* TAB: MANUAL */}
          {tab === "manual" && (
            <div className="space-y-4">
              <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1">
                {/* Sekcja 1: Podstawowe */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#bce663] border-b border-[#2b2d24]/50 pb-1">Podstawowy skład ciała</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Waga (kg)" value={weight} onChange={setWeight} placeholder="78.5" />
                    <Input label="Tłuszcz (%)" value={bodyFat} onChange={setBodyFat} placeholder="14.2" />
                    <Input label="Mięśnie (kg)" value={muscleMass} onChange={setMuscleMass} placeholder="38.1" />
                  </div>
                </div>

                {/* Sekcja 2: Główne wskaźniki */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182] border-b border-[#2b2d24]/30 pb-1">Wskaźniki ogólne</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="BMI" value={bmi} onChange={setBmi} placeholder="22.5" />
                    <Input label="Wynik (0-100)" value={bodyScore} onChange={setBodyScore} placeholder="85" />
                    <Input label="BMR (kcal)" value={basalMetabolism} onChange={setBasalMetabolism} placeholder="1750" />
                    <Input label="Wiek biol. (lat)" value={metabolicAge} onChange={setMetabolicAge} placeholder="28" />
                    <Input label="Tłuszcz trzewny" value={visceralFat} onChange={setVisceralFat} placeholder="5" />
                    <Input label="Idealna waga (kg)" value={idealWeight} onChange={setIdealWeight} placeholder="75.0" />
                    <Input label="Typ sylwetki" value={bodyType} onChange={setBodyType} placeholder="zrównoważona" type="text" />
                    <Input label="Bez tłuszczu (kg)" value={leanBodyMass} onChange={setLeanBodyMass} placeholder="64.2" />
                  </div>
                </div>

                {/* Sekcja 3: Masy składników */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182] border-b border-[#2b2d24]/30 pb-1">Masy składników (kg)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Masa wody" value={waterMass} onChange={setWaterMass} placeholder="48.2" />
                    <Input label="Masa tłuszczu" value={fatMass} onChange={setFatMass} placeholder="11.5" />
                    <Input label="Masa białka" value={proteinMass} onChange={setProteinMass} placeholder="12.4" />
                    <Input label="Masa kości" value={boneMass} onChange={setBoneMass} placeholder="3.2" />
                    <Input label="Mięśnie szkielet." value={skeletalMuscleMass} onChange={setSkeletalMuscleMass} placeholder="35.4" />
                  </div>
                </div>

                {/* Sekcja 4: Procenty */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182] border-b border-[#2b2d24]/30 pb-1">Udziały procentowe (%)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Woda %" value={bodyWaterPct} onChange={setBodyWaterPct} placeholder="58.2" />
                    <Input label="Białko %" value={proteinPct} onChange={setProteinPct} placeholder="18.5" />
                    <Input label="Mięśnie %" value={musclePct} onChange={setMusclePct} placeholder="78.2" />
                    <Input label="Kości %" value={bonePct} onChange={setBonePct} placeholder="4.2" />
                    <Input label="Mięśnie szkielet. %" value={skeletalMusclePct} onChange={setSkeletalMusclePct} placeholder="52.4" />
                  </div>
                </div>

                {/* Sekcja 5: Zaawansowane */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182] border-b border-[#2b2d24]/30 pb-1">Proporcje i wskaźniki</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Wskaźnik WHR" value={waistToHipRatio} onChange={setWaistToHipRatio} placeholder="0.82" />
                  </div>
                </div>

                {/* Sekcja 6: Obwody ciała */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182] border-b border-[#2b2d24]/30 pb-1">Obwody ciała (cm)</p>
                  <CircumferenceFields
                    waist={waist} setWaist={setWaist}
                    chest={chest} setChest={setChest}
                    hips={hips} setHips={setHips}
                    thigh={thigh} setThigh={setThigh}
                    bicep={bicep} setBicep={setBicep}
                    calf={calf} setCalf={setCalf}
                    shoulder={shoulder} setShoulder={setShoulder}
                  />
                </div>
              </div>

              <button
                onClick={handleSaveManual}
                disabled={saving}
                className="w-full rounded-xl bg-[#bce663] py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
              >
                {saving ? "Zapisuję..." : "Zapisz pomiar"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Input({ label, value, onChange, placeholder, type = "number" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">{label}</label>
      <input
        type={type}
        step={type === "number" ? "0.1" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white outline-none font-mono"
      />
    </div>
  );
}

function CircumferenceFields(props: {
  waist: string; setWaist: (v: string) => void;
  chest: string; setChest: (v: string) => void;
  hips: string; setHips: (v: string) => void;
  thigh: string; setThigh: (v: string) => void;
  bicep: string; setBicep: (v: string) => void;
  calf: string; setCalf: (v: string) => void;
  shoulder: string; setShoulder: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      <Input label="Klatka" value={props.chest} onChange={props.setChest} placeholder="104" />
      <Input label="Talia" value={props.waist} onChange={props.setWaist} placeholder="82" />
      <Input label="Biodra" value={props.hips} onChange={props.setHips} placeholder="96" />
      <Input label="Udo" value={props.thigh} onChange={props.setThigh} placeholder="58" />
      <Input label="Biceps" value={props.bicep} onChange={props.setBicep} placeholder="36" />
      <Input label="Łydka" value={props.calf} onChange={props.setCalf} placeholder="38" />
      <Input label="Ramię" value={props.shoulder} onChange={props.setShoulder} placeholder="120" />
    </div>
  );
}

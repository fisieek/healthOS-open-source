"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Sparkles, X, Save, Clock, Heart, Flame, Navigation, AlertCircle } from "lucide-react";
import { IntensityClass } from "@/app/generated/prisma/client";

interface RunningActivityExtractResult {
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

const INTENSITY_LABELS: Record<IntensityClass, string> = {
  RECOVERY: "Regeneracyjny (Z1)",
  EASY: "Spokojny (Z2)",
  STEADY: "Steady (Z3)",
  TEMPO: "Tempo (Z3/Z4)",
  THRESHOLD: "Progowy (Z4)",
  INTERVAL: "Interwały (Z5)",
  LONG: "Długi bieg",
  RACE: "Zawody",
  OTHER: "Inny",
};

export default function AiUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "scanning" | "verify" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Dane wyekstrahowane i edytowalne
  const [extractedData, setExtractedData] = useState<Partial<RunningActivityExtractResult>>({});
  const [editableDate, setEditableDate] = useState("");
  const [editableDistance, setEditableDistance] = useState("");
  const [durationH, setDurationH] = useState("0");
  const [durationM, setDurationM] = useState("0");
  const [durationS, setDurationS] = useState("0");
  const [editableAvgHr, setEditableAvgHr] = useState("");
  const [editableMaxHr, setEditableMaxHr] = useState("");
  const [editableCalories, setEditableCalories] = useState("");
  const [editableElevGain, setEditableElevGain] = useState("");
  const [editableDeviceName, setEditableDeviceName] = useState("");
  const [editableNotes, setEditableNotes] = useState("");
  const [editableIntensity, setEditableIntensity] = useState<IntensityClass>("EASY");
  
  // Strefy tętna
  const [zoneZ1, setZoneZ1] = useState("");
  const [zoneZ2, setZoneZ2] = useState("");
  const [zoneZ3, setZoneZ3] = useState("");
  const [zoneZ4, setZoneZ4] = useState("");
  const [zoneZ5, setZoneZ5] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const isSaving = status === "saving";

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith("image/")) {
        processFile(droppedFile);
      } else {
        showError("Dozwolone są wyłącznie pliki graficzne (JPEG, PNG, WEBP)");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setStatus("error");
  };

  const resetAll = () => {
    setFile(null);
    setImagePreview(null);
    setStatus("idle");
    setErrorMsg(null);
    setExtractedData({});
    setEditableDate("");
    setEditableDistance("");
    setDurationH("0");
    setDurationM("0");
    setDurationS("0");
    setEditableAvgHr("");
    setEditableMaxHr("");
    setEditableCalories("");
    setEditableElevGain("");
    setEditableDeviceName("");
    setEditableNotes("");
    setEditableIntensity("EASY");
    setZoneZ1("");
    setZoneZ2("");
    setZoneZ3("");
    setZoneZ4("");
    setZoneZ5("");
  };

  const processFile = (selectedFile: File) => {
    resetAll();
    setFile(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
    uploadAndScan(selectedFile);
  };

  const uploadAndScan = async (selectedFile: File) => {
    setStatus("uploading");
    
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Symulacja skanowania dla efektu wizualnego i wywołanie API
      setStatus("scanning");
      
      const res = await fetch("/api/bieg/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Błąd analizy zdjęcia");
      }

      const resData = await res.json();
      const extracted: RunningActivityExtractResult = resData.data;

      // Wypełnij stan danymi z AI
      setExtractedData(extracted);
      
      // Dzisiejsza data jako fallback
      const todayISO = new Date().toISOString().split("T")[0];
      setEditableDate(extracted.date || todayISO);
      setEditableDistance(extracted.distanceKm ? String(extracted.distanceKm) : "");
      
      if (extracted.durationSec) {
        const sec = extracted.durationSec;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        setDurationH(String(h));
        setDurationM(String(m));
        setDurationS(String(s));
      } else {
        setDurationH("0");
        setDurationM("0");
        setDurationS("0");
      }

      setEditableAvgHr(extracted.avgHr ? String(extracted.avgHr) : "");
      setEditableMaxHr(extracted.maxHr ? String(extracted.maxHr) : "");
      setEditableCalories(extracted.calories ? String(extracted.calories) : "");
      setEditableElevGain(extracted.elevGain ? String(extracted.elevGain) : "");
      setEditableDeviceName(extracted.deviceName || "Zdjęcie zegarka");
      setEditableNotes(extracted.notes || "");

      // Automatyczna klasyfikacja intensywności na bazie tętna
      if (extracted.avgHr && extracted.maxHr) {
        const ratio = extracted.avgHr / extracted.maxHr;
        if (ratio >= 0.92) setEditableIntensity("INTERVAL");
        else if (ratio >= 0.85) setEditableIntensity("THRESHOLD");
        else if (ratio >= 0.78) setEditableIntensity("TEMPO");
        else if (extracted.durationSec && extracted.durationSec >= 90 * 60) setEditableIntensity("LONG");
        else if (ratio >= 0.65) setEditableIntensity("EASY");
        else if (ratio >= 0.5) setEditableIntensity("RECOVERY");
      } else {
        setEditableIntensity("EASY");
      }

      // Strefy tętna
      if (extracted.zoneMinutes) {
        setZoneZ1(extracted.zoneMinutes.z1 ? String(extracted.zoneMinutes.z1) : "");
        setZoneZ2(extracted.zoneMinutes.z2 ? String(extracted.zoneMinutes.z2) : "");
        setZoneZ3(extracted.zoneMinutes.z3 ? String(extracted.zoneMinutes.z3) : "");
        setZoneZ4(extracted.zoneMinutes.z4 ? String(extracted.zoneMinutes.z4) : "");
        setZoneZ5(extracted.zoneMinutes.z5 ? String(extracted.zoneMinutes.z5) : "");
      }

      setStatus("verify");
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Wystąpił nieoczekiwany błąd podczas przesyłania.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");

    const totalSeconds = 
      (parseInt(durationH) || 0) * 3600 + 
      (parseInt(durationM) || 0) * 60 + 
      (parseInt(durationS) || 0);

    const payload = {
      distanceKm: parseFloat(editableDistance),
      durationSec: totalSeconds,
      avgHr: editableAvgHr ? parseInt(editableAvgHr) : null,
      maxHr: editableMaxHr ? parseInt(editableMaxHr) : null,
      calories: editableCalories ? parseInt(editableCalories) : null,
      elevGain: editableElevGain ? parseFloat(editableElevGain) : null,
      date: editableDate,
      deviceName: editableDeviceName,
      notes: editableNotes,
      intensityClass: editableIntensity,
      zoneMinutes: {
        z1: zoneZ1 ? parseInt(zoneZ1) : 0,
        z2: zoneZ2 ? parseInt(zoneZ2) : 0,
        z3: zoneZ3 ? parseInt(zoneZ3) : 0,
        z4: zoneZ4 ? parseInt(zoneZ4) : 0,
        z5: zoneZ5 ? parseInt(zoneZ5) : 0,
      }
    };

    try {
      const res = await fetch("/api/bieg/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Nie udało się zapisać biegu");
      }

      setStatus("success");
      setTimeout(() => {
        resetAll();
        window.location.reload(); // Przeładuj stronę, aby odświeżyć historię i rekordy!
      }, 1500);
    } catch (err: any) {
      showError(err.message || "Błąd zapisu biegu.");
    }
  };

  return (
    <div className="bg-[#1a1c18] border border-[#2b2d24] rounded-2xl p-5 hover:border-[#bce663]/40 transition-all duration-300 relative overflow-hidden group">
      {/* Ozdobny gradient tle */}
      <div className="absolute -right-16 -top-16 w-36 h-36 bg-[#bce663]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#bce663]/15 transition-all duration-500"></div>

      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 text-[#bce663] group-hover:border-[#bce663]/40 transition-colors">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Dodaj Bieg AI
            <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-[#bce663]/10 text-[#bce663] border border-[#bce663]/20">
              Gemini 3.5 Flash
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Wgraj zdjęcie ekranu zegarka – AI wyekstrahuje pełne dane</p>
        </div>
      </div>

      {status === "idle" && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? "border-[#bce663] bg-[#bce663]/5"
              : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <div className="p-4 bg-zinc-900/50 border border-zinc-850 rounded-2xl text-zinc-400 group-hover:text-[#bce663] transition-colors mb-3">
            <UploadCloud className="w-8 h-8" />
          </div>
          <p className="text-sm font-semibold text-zinc-200 text-center">
            Przeciągnij zdjęcie lub kliknij, aby wybrać
          </p>
          <p className="text-xs text-zinc-500 text-center mt-1">
            Ekran Garmina, Polar, Apple Watch lub screen z aplikacji sportowej
          </p>
        </div>
      )}

      {(status === "uploading" || status === "scanning") && (
        <div className="border border-zinc-850 rounded-xl p-8 flex flex-col items-center justify-center relative bg-zinc-900/40 overflow-hidden">
          {/* Efekt skanowania - neonowa linia */}
          {status === "scanning" && (
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#bce663] to-transparent animate-pulse" 
                 style={{ 
                   animation: "scan 2s linear infinite",
                   boxShadow: "0 0 12px 2px rgba(188, 230, 99, 0.6)" 
                 }} 
            />
          )}

          {imagePreview && (
            <div className="relative w-36 h-36 rounded-xl overflow-hidden mb-4 border border-zinc-800 shadow-xl">
              <img src={imagePreview} alt="Podgląd" className="w-full h-full object-cover filter brightness-90" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-t-[#bce663] border-zinc-700 rounded-full animate-spin"></div>
              </div>
            </div>
          )}

          <h4 className="text-sm font-bold text-white mb-1 animate-pulse">
            {status === "uploading" ? "Wysyłanie zdjęcia..." : "AI analizuje zdjęcie zegarka..."}
          </h4>
          <p className="text-xs text-zinc-400 text-center max-w-xs">
            Najnowszy model Gemini 3.5 Flash odczytuje dystans, czas trwania, tętna i strefy wysiłku...
          </p>
        </div>
      )}

      {status === "verify" && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-4 p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
            {imagePreview && (
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                <img src={imagePreview} alt="Podgląd" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col justify-center">
              <div className="text-[10px] uppercase font-mono text-[#bce663]">Zdjęcie przetworzone pomyślnie</div>
              <div className="text-sm font-bold text-white mt-0.5 truncate max-w-[200px]">
                {editableDeviceName || "Nieznane urządzenie"}
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 mt-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Usuń i wgraj inne
              </button>
            </div>
          </div>

          <div className="text-xs font-mono text-zinc-400 border-b border-zinc-850 pb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#bce663]" /> Weryfikacja danych AI
          </div>

          {/* Główny grid formularza */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Data</label>
              <input
                type="date"
                required
                value={editableDate}
                onChange={(e) => setEditableDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#bce663] transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Dystans (km)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="np. 5.24"
                  value={editableDistance}
                  onChange={(e) => setEditableDistance(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-2.5 pr-8 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-zinc-500 font-mono">km</span>
              </div>
            </div>
          </div>

          {/* Czas trwania - Trzy pola */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Czas Trwania</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="relative">
                <input
                  type="number"
                  placeholder="H"
                  value={durationH}
                  onChange={(e) => setDurationH(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm font-mono text-center text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <span className="absolute right-1 top-0.5 text-[8px] text-zinc-600 font-mono">g</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder="M"
                  value={durationM}
                  onChange={(e) => setDurationM(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm font-mono text-center text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <span className="absolute right-1 top-0.5 text-[8px] text-zinc-600 font-mono">m</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  placeholder="S"
                  value={durationS}
                  onChange={(e) => setDurationS(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm font-mono text-center text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <span className="absolute right-1 top-0.5 text-[8px] text-zinc-600 font-mono">s</span>
              </div>
            </div>
          </div>

          {/* HR parameters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tętno Średnie</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="np. 145"
                  value={editableAvgHr}
                  onChange={(e) => setEditableAvgHr(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-2.5 pr-10 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <Heart className="absolute right-2.5 top-2 w-3.5 h-3.5 text-red-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tętno Maks.</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="np. 178"
                  value={editableMaxHr}
                  onChange={(e) => setEditableMaxHr(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-2.5 pr-10 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <Heart className="absolute right-2.5 top-2 w-3.5 h-3.5 text-rose-600" />
              </div>
            </div>
          </div>

          {/* Calories & Elev gain */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Kalorie (kcal)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="np. 450"
                  value={editableCalories}
                  onChange={(e) => setEditableCalories(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-2.5 pr-10 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <Flame className="absolute right-2.5 top-2 w-3.5 h-3.5 text-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Wznios (m)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="np. 20"
                  value={editableElevGain}
                  onChange={(e) => setEditableElevGain(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-2.5 pr-8 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#bce663] transition-all"
                />
                <Navigation className="absolute right-2.5 top-2 w-3.5 h-3.5 text-sky-500 rotate-45" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Intensywność</label>
              <select
                value={editableIntensity}
                onChange={(e) => setEditableIntensity(e.target.value as IntensityClass)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#bce663] transition-all"
              >
                {Object.entries(INTENSITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Urządzenie</label>
              <input
                type="text"
                placeholder="np. Garmin Forerunner"
                value={editableDeviceName}
                onChange={(e) => setEditableDeviceName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#bce663] transition-all"
              />
            </div>
          </div>

          {/* Strefy tętna (Zone Minutes) */}
          <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Rozkład stref tętna (minuty)</div>
            <div className="grid grid-cols-5 gap-1.5">
              <div>
                <span className="block text-[8px] text-zinc-500 font-mono mb-0.5 text-center">Z1</span>
                <input
                  type="number"
                  placeholder="0"
                  value={zoneZ1}
                  onChange={(e) => setZoneZ1(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center font-mono text-xs text-zinc-300 focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <span className="block text-[8px] text-zinc-500 font-mono mb-0.5 text-center">Z2</span>
                <input
                  type="number"
                  placeholder="0"
                  value={zoneZ2}
                  onChange={(e) => setZoneZ2(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center font-mono text-xs text-zinc-300 focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <span className="block text-[8px] text-zinc-500 font-mono mb-0.5 text-center">Z3</span>
                <input
                  type="number"
                  placeholder="0"
                  value={zoneZ3}
                  onChange={(e) => setZoneZ3(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center font-mono text-xs text-zinc-300 focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <span className="block text-[8px] text-zinc-500 font-mono mb-0.5 text-center">Z4</span>
                <input
                  type="number"
                  placeholder="0"
                  value={zoneZ4}
                  onChange={(e) => setZoneZ4(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center font-mono text-xs text-zinc-300 focus:outline-none focus:border-[#bce663]"
                />
              </div>
              <div>
                <span className="block text-[8px] text-zinc-500 font-mono mb-0.5 text-center">Z5</span>
                <input
                  type="number"
                  placeholder="0"
                  value={zoneZ5}
                  onChange={(e) => setZoneZ5(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 text-center font-mono text-xs text-zinc-300 focus:outline-none focus:border-[#bce663]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Notatki / odczucia</label>
            <textarea
              placeholder="np. Nogi były ciężkie, ale tętno stabilne..."
              value={editableNotes}
              onChange={(e) => setEditableNotes(e.target.value)}
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#bce663] transition-all resize-none"
            />
          </div>

          {/* Akcja ostateczna */}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={resetAll}
              disabled={isSaving}
              className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs font-bold py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-[#bce663] hover:bg-[#a6d14f] text-[#0d0e0c] text-xs font-bold py-2 rounded-xl transition-all shadow-[0_2px_12px_rgba(188,230,99,0.3)] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Zapisywanie..." : "Zatwierdź i zapisz"}
            </button>
          </div>
        </form>
      )}

      {status === "success" && (
        <div className="border border-zinc-850 rounded-xl p-8 flex flex-col items-center justify-center bg-zinc-900/40">
          <div className="w-12 h-12 rounded-full bg-[#bce663]/20 border border-[#bce663] flex items-center justify-center text-[#bce663] mb-4 animate-bounce">
            ✓
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Bieg zapisany pomyślne!</h4>
          <p className="text-xs text-zinc-400 text-center">
            Trwa odświeżanie statystyk, wskaźnika VO2max oraz historii...
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="border border-red-950/40 rounded-xl p-6 bg-red-950/10 flex flex-col items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
          <h4 className="text-sm font-bold text-white mb-1">Błąd analizy AI</h4>
          <p className="text-xs text-red-400 text-center mb-4 max-w-xs">{errorMsg}</p>
          <button
            onClick={resetAll}
            className="bg-zinc-900 hover:bg-zinc-850 text-white text-xs px-4 py-2 border border-zinc-800 rounded-xl transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Styl skanowania w CSS */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}

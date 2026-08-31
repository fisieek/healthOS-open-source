"use client";

import { useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface ExtractedRun {
  distanceKm: number | null;
  durationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevGain: number | null;
  date: string | null;
  deviceName: string | null;
  notes: string | null;
}

export default function BiegUploadButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExtractedRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state for manual edit after preview
  const [name, setName] = useState("");
  const [intensityClass, setIntensityClass] = useState("EASY");

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSuccess(false);
    setName("");
    setIntensityClass("EASY");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/bieg/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Błąd analizy");
      setPreview(json.data);
      setName(`Bieg ${json.data.date ?? new Date().toLocaleDateString("pl-PL")}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bieg/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Bieg",
          date: preview.date ?? new Date().toISOString().split("T")[0],
          distanceKm: preview.distanceKm,
          durationSec: preview.durationSec,
          avgHr: preview.avgHr,
          maxHr: preview.maxHr,
          calories: preview.calories,
          elevGain: preview.elevGain,
          intensityClass,
          notes: preview.notes,
          deviceName: preview.deviceName,
          zoneMinutes: null,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Błąd zapisu");
      }
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        reset();
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (sec: number | null) => {
    if (!sec) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-2 rounded-xl bg-[#bce663] px-4 py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] transition-all shrink-0"
      >
        <Plus className="h-4 w-4" />
        Dodaj trening
      </button>

      <Modal
        isOpen={open}
        onClose={() => { setOpen(false); reset(); }}
        title="Dodaj bieg z zegarka / aplikacji"
        description="Wgraj zdjęcie ekranu zegarka lub raportu — AI wyciągnie dane automatycznie."
        size="md"
      >
        {success ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-4xl">✓</div>
            <p className="text-sm font-bold text-[#bce663]">Bieg zapisany!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File picker */}
            {!file ? (
              <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#2b2d24] bg-[#141511] p-8 cursor-pointer hover:border-[#bce663]/50 transition-all">
                <Upload className="h-8 w-8 text-[#5d6050]" />
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Przeciągnij zdjęcie lub kliknij</p>
                  <p className="text-xs text-[#8e9182] mt-1">Garmin, Polar, Apple Watch, Strava (PNG, JPG)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#2b2d24] bg-[#141511]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{file.name}</p>
                  <p className="text-[10px] text-[#8e9182]">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => { setFile(null); setPreview(null); }} className="p-1.5 rounded-lg text-[#8e9182] hover:text-white hover:bg-[#2b2d24]">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
            )}

            {/* Preview */}
            {preview && (
              <div className="rounded-xl border border-[#2b2d24] bg-[#141511] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#bce663]">Wyekstrahowane dane</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    ["Dystans", preview.distanceKm ? `${preview.distanceKm.toFixed(2)} km` : "—"],
                    ["Czas", fmt(preview.durationSec)],
                    ["Śr. HR", preview.avgHr ? `${preview.avgHr} bpm` : "—"],
                    ["Max HR", preview.maxHr ? `${preview.maxHr} bpm` : "—"],
                    ["Kalorie", preview.calories ? `${preview.calories} kcal` : "—"],
                    ["Wznios", preview.elevGain ? `${preview.elevGain} m` : "—"],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-[#1a1c18] rounded-lg p-2">
                      <p className="text-[9px] text-[#8e9182] uppercase">{label}</p>
                      <p className="font-bold text-white mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Nazwa treningu</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#8e9182]">Intensywność</label>
                  <select
                    value={intensityClass}
                    onChange={(e) => setIntensityClass(e.target.value)}
                    className="w-full bg-[#0d0e0c] border border-[#2b2d24] focus:border-[#bce663] rounded-xl px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="EASY">Easy</option>
                    <option value="STEADY">Steady</option>
                    <option value="TEMPO">Tempo</option>
                    <option value="THRESHOLD">Threshold</option>
                    <option value="INTERVAL">Interwały</option>
                    <option value="LONG">Long</option>
                    <option value="RACE">Zawody</option>
                    <option value="RECOVERY">Recovery</option>
                  </select>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {!preview ? (
                <button
                  onClick={handleAnalyze}
                  disabled={!file || loading}
                  className="flex-1 rounded-xl bg-[#bce663] py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
                >
                  {loading ? "Analizuję..." : "Analizuj zdjęcie"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setPreview(null); setFile(null); }}
                    className="flex-1 rounded-xl border border-[#2b2d24] py-2.5 text-xs font-bold text-[#8e9182] hover:bg-[#2b2d24] hover:text-white transition-all"
                  >
                    Wgraj inne
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-[#bce663] py-2.5 text-xs font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] disabled:opacity-50 transition-all"
                  >
                    {saving ? "Zapisuję..." : "Zapisz bieg"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

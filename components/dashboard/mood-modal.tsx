"use client";

import { useState } from "react";
import { X, Zap, Smile, AlertTriangle, Loader2 } from "lucide-react";

interface MoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData?: {
    energyScore?: number | null;
    moodScore?: number | null;
    stressScore?: number | null;
    notes?: string | null;
  } | null;
  dateStr: string;
}

export default function MoodModal({ isOpen, onClose, onSave, initialData, dateStr }: MoodModalProps) {
  const [energy, setEnergy] = useState<number>(initialData?.energyScore || 5);
  const [mood, setMood] = useState<number>(initialData?.moodScore || 5);
  const [stress, setStress] = useState<number>(initialData?.stressScore || 5);
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/log/wellness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          energyScore: energy,
          moodScore: mood,
          stressScore: stress,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Wystąpił błąd podczas zapisywania.");
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || "Coś poszło nie tak.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (val: number, type: "energy" | "mood" | "stress") => {
    if (type === "stress") {
      if (val <= 3) return "text-lime-400";
      if (val <= 7) return "text-yellow-400";
      return "text-red-400";
    } else {
      if (val >= 7) return "text-lime-400";
      if (val >= 4) return "text-yellow-400";
      return "text-red-400";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#2b2d24] bg-[#141511] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2b2d24] pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Zapisz samopoczucie</h3>
            <p className="text-xs text-[#8e9182] mt-0.5">Dzień: {dateStr}</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8e9182] hover:bg-[#1f2119] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-950/40 border border-red-900/50 p-3 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Energy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-[#e2e3d8]">
                <Zap className="h-4 w-4 text-amber-400" /> Poziom Energii
              </span>
              <span className={`text-sm font-bold ${getScoreColor(energy, "energy")}`}>{energy}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={energy}
              onChange={(e) => setEnergy(parseInt(e.target.value))}
              className="w-full h-1 bg-[#2b2d24] rounded-lg appearance-none cursor-pointer accent-[#bce663]"
            />
            <div className="flex justify-between text-[10px] text-[#8e9182]">
              <span>Wykończenie</span>
              <span>Pełna moc</span>
            </div>
          </div>

          {/* Mood */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-[#e2e3d8]">
                <Smile className="h-4 w-4 text-sky-400" /> Nastrój
              </span>
              <span className={`text-sm font-bold ${getScoreColor(mood, "mood")}`}>{mood}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={mood}
              onChange={(e) => setMood(parseInt(e.target.value))}
              className="w-full h-1 bg-[#2b2d24] rounded-lg appearance-none cursor-pointer accent-[#bce663]"
            />
            <div className="flex justify-between text-[10px] text-[#8e9182]">
              <span>Dół psychiczny</span>
              <span>Wspaniały</span>
            </div>
          </div>

          {/* Stress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-[#e2e3d8]">
                <AlertTriangle className="h-4 w-4 text-purple-400" /> Poziom Stresu
              </span>
              <span className={`text-sm font-bold ${getScoreColor(stress, "stress")}`}>{stress}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={stress}
              onChange={(e) => setStress(parseInt(e.target.value))}
              className="w-full h-1 bg-[#2b2d24] rounded-lg appearance-none cursor-pointer accent-[#bce663]"
            />
            <div className="flex justify-between text-[10px] text-[#8e9182]">
              <span>Brak (Zen)</span>
              <span>Ekstremalny</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#e2e3d8]">Notatki / Przemyślenia</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jak minął dzień? Co wpłynęło na Twoje samopoczucie?"
              className="w-full rounded-xl border border-[#2b2d24] bg-[#1b1c16] px-3 py-2 text-sm text-white placeholder-[#5d6050] focus:border-[#bce663] focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[#2b2d24] bg-[#141511] px-4 py-2 text-sm font-medium text-[#e2e3d8] hover:bg-[#1f2119] transition-colors disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#bce663] px-5 py-2 text-sm font-bold text-[#0d0e0c] hover:bg-[#a6cc4f] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                "Zapisz"
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

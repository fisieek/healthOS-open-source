"use client";

import { useState, useEffect } from "react";
import { Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Klucz Gemini napędza całą analizę AI (skład ciała, badania krwi, suplementy,
 * zdjęcia treningów). W apce desktopowej nie ma env vars, więc klucz podaje się tutaj.
 */
export function GeminiKeyForm() {
  const [hasKey, setHasKey] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [envFallback, setEnvFallback] = useState(false);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/gemini-key")
      .then((r) => r.json())
      .then((d) => {
        setHasKey(!!d.hasKey);
        setMasked(d.masked ?? null);
        setEnvFallback(!!d.envFallback);
        setEditing(!d.hasKey && !d.envFallback);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      if (res.ok) {
        setHasKey(true);
        setMasked(`…${value.trim().slice(-4)}`);
        setValue("");
        setEditing(false);
        setMessage("✓ Klucz zapisany");
      } else {
        const d = await res.json();
        setMessage(`✗ ${d.error || "Błąd zapisu"}`);
      }
    } catch {
      setMessage("✗ Błąd połączenia");
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async () => {
    if (!confirm("Usunąć zapisany klucz Gemini? Analiza AI przestanie działać.")) return;
    try {
      const res = await fetch("/api/settings/gemini-key", { method: "DELETE" });
      if (res.ok) {
        setHasKey(false);
        setMasked(null);
        setEditing(!envFallback);
        setMessage("✓ Klucz usunięty");
        setTimeout(() => setMessage(null), 3000);
      }
    } catch {}
  };

  const connected = hasKey || envFallback;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#f1f2ec]">Gemini AI</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {connected ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-[#8c9282]">
                    {hasKey ? `Klucz skonfigurowany (${masked})` : "Klucz z env (web)"}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-[#8c9282]" />
                  <span className="text-xs text-[#8c9282]">Brak klucza — analiza AI nie działa</span>
                </>
              )}
            </div>
          </div>
        </div>
        {loaded && hasKey && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="text-xs h-8 border-[#2e3229] text-[#f1f2ec] hover:bg-[#2e3229]"
          >
            Zmień klucz
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSave} className="pl-11 pt-2 border-t border-[#2e3229] space-y-2">
          <Label className="text-xs text-[#8c9282]">
            Klucz API Gemini (z aistudio.google.com/apikey)
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="AIza..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-[#1a1c18] border-[#2e3229] text-[#f1f2ec] text-xs font-mono flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={saving || !value.trim()}
              className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs h-9 px-4"
            >
              {saving ? "..." : "Zapisz"}
            </Button>
          </div>
          <p className="text-[10px] text-[#8c9282]">
            Napędza analizę AI: skład ciała, badania krwi, suplementy, zdjęcia treningów.
            Klucz jest darmowy w Google AI Studio.
          </p>
        </form>
      )}

      {message && (
        <p className={`text-xs pl-11 ${message.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>
          {message}
        </p>
      )}

      {hasKey && !editing && (
        <div className="flex justify-end pl-11">
          <button
            onClick={handleDelete}
            className="text-[10px] text-[#8c9282] hover:text-rose-400 transition-colors"
          >
            Usuń klucz
          </button>
        </div>
      )}
    </div>
  );
}

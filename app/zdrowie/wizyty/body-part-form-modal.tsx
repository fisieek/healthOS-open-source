"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Dictionaries } from "./constants";

interface Props {
  open: boolean;
  onClose: () => void;
  dictionaries: Dictionaries;
  onSaved: () => void;
}

/**
 * Zakłada część ciała („Powód/Część ciała") i zawsze pierwszy epizod leczenia.
 * Do tej pory część ciała mogła powstać wyłącznie jako efekt uboczny dodania
 * wizyty lub badania, więc nie dało się przygotować karty, do której dopiero
 * potem podepnie się istniejące rekordy.
 *
 * Epizod jest tworzony bezwarunkowo — skoro user wypełnia ten formularz, zakłada
 * leczenie. Samą część ciała bez epizodu da się nadal wybrać w „Podepnij istniejące".
 */
export function BodyPartFormModal({ open, onClose, dictionaries, onSaved }: Props) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      // Słownik jest upsertem po [userId, name] — wpisanie istniejącej nazwy
      // nie utworzy duplikatu, tylko zwróci istniejącą część ciała.
      const res = await fetch("/api/health/dictionaries/body-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        setError("Nie udało się zapisać części ciała.");
        return;
      }
      const bodyPart = await res.json();

      const epRes = await fetch("/api/health/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyPartId: bodyPart.id,
          title: episodeTitle.trim() || `${trimmed} ${new Date().getFullYear()}`,
          startDate,
        }),
      });
      if (!epRes.ok) {
        setError(
          "Część ciała zapisana, ale nie udało się utworzyć leczenia. Dodaj je z karty części ciała."
        );
        onSaved();
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Błąd sieci przy zapisie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Nowa część ciała / leczenie"
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Część ciała / powód</Label>
          <Input
            type="text"
            placeholder="np. Kolano lewe, Tarczyca"
            list="bpf-bodyparts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            required
          />
          <datalist id="bpf-bodyparts">
            {dictionaries.bodyParts.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Notatki (opcjonalnie)</Label>
          <Textarea
            placeholder="np. uraz z rowerowego zjazdu, lewa strona"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs min-h-[50px]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Nazwa leczenia</Label>
            <Input
              type="text"
              placeholder={
                name.trim()
                  ? `${name.trim()} ${new Date().getFullYear()}`
                  : "np. Uraz łąkotki 2026"
              }
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Początek leczenia</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs"
          >
            Anuluj
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
          >
            {loading ? "Zapisywanie..." : "Utwórz"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

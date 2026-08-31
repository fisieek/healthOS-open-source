"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Quote } from "lucide-react";
import {
  IMAGING_MODALITIES,
  episodeStatusMeta,
  type Dictionaries,
} from "./constants";

/** Propozycja badania kontrolnego zwrócona przez trasę `summarize`. */
export interface FollowUpSuggestion {
  recommended: boolean;
  what: string | null;
  modality: string | null;
  /** YYYY-MM-DD albo null = termin nieustalony (AI nie znalazło terminu). */
  date: string | null;
  quote: string | null;
  dismissed: boolean;
  bodyPartName: string | null;
  episodeId: string | null;
  episodeTitle: string | null;
}

interface Props {
  open: boolean;
  /** Dokument źródłowy, z którego opisu wynika zalecenie. */
  sourceDocumentId: string;
  suggestion: FollowUpSuggestion;
  dictionaries: Dictionaries;
  onClose: () => void;
  /** Wywoływane po zapisaniu badania kontrolnego albo po odrzuceniu. */
  onResolved: () => void;
}

/** Modalność → rodzaj badania w naszym słowniku typów. */
function typeForModality(modality: string | null): string {
  if (!modality) return "IMAGING";
  const m = modality.toUpperCase();
  if (IMAGING_MODALITIES.includes(m)) return "IMAGING";
  if (m.includes("KRW")) return "BLOOD_TEST";
  if (m.includes("MOCZ")) return "URINE_TEST";
  return "OTHER";
}

/**
 * Potwierdzenie dodania badania kontrolnego zaproponowanego przez AI.
 *
 * Nic nie zapisuje się samo: dopóki użytkownik nie kliknie „Dodaj badanie",
 * w bazie nie powstaje żaden rekord. Odrzucenie jest zapamiętywane
 * (`HealthDocument.aiSuggestions`), więc po odświeżeniu nie pytamy ponownie.
 */
export function FollowUpModal({
  open,
  sourceDocumentId,
  suggestion,
  dictionaries,
  onClose,
  onResolved,
}: Props) {
  const [title, setTitle] = useState(suggestion.what ?? "Badanie kontrolne");
  const [date, setDate] = useState(suggestion.date ?? "");
  const [episodeId, setEpisodeId] = useState(suggestion.episodeId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Zapisuje decyzję na dokumencie źródłowym — w obie strony widoczne powiązanie. */
  async function patchSource(body: Record<string, unknown>) {
    await fetch(`/api/health/documents/${sourceDocumentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/health/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Badanie kontrolne",
          type: typeForModality(suggestion.modality),
          status: "PLANNED",
          plannedDate: date || null,
          bodyPart: suggestion.bodyPartName ?? undefined,
          episodeId: episodeId || null,
          tags:
            suggestion.modality &&
            IMAGING_MODALITIES.includes(suggestion.modality.toUpperCase())
              ? [suggestion.modality.toUpperCase()]
              : [],
        }),
      });
      if (!res.ok) {
        setError("Nie udało się utworzyć badania kontrolnego.");
        return;
      }
      // Na dokumencie źródłowym odnotowujemy, że kontrola z niego wynika.
      await patchSource({
        followUpDate: date || null,
        followUpNote: title.trim() || null,
        aiSuggestions: {
          followUp: { accepted: true, dismissed: false, at: new Date().toISOString() },
        },
      });
      onResolved();
      onClose();
    } catch {
      setError("Błąd sieci przy zapisie.");
    } finally {
      setSaving(false);
    }
  }

  async function decline() {
    setSaving(true);
    try {
      await patchSource({
        aiSuggestions: {
          followUp: { accepted: false, dismissed: true, at: new Date().toISOString() },
        },
      });
      onResolved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const episodeOptions = dictionaries.episodes;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Czy chcesz dodać badanie kontrolne?"
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-[#8c9282]">Nazwa badania</Label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Termin</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs"
            />
            <p className="text-[10px] text-[#5d6050]">
              {suggestion.date
                ? `Wyliczony z zaleceń: ${format(new Date(suggestion.date), "dd.MM.yyyy")}`
                : "AI nie znalazło terminu w dokumencie — możesz go dopisać."}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#8c9282]">Leczenie (epizod)</Label>
            <select
              value={episodeId}
              onChange={(e) => setEpisodeId(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50"
            >
              <option value="">— brak —</option>
              {episodeOptions.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.title} ({episodeStatusMeta(ep.status).label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Podstawa sugestii — user ma widzieć, z czego ona wynika. */}
        {suggestion.quote && (
          <div className="rounded-lg border border-[#2e3229] bg-[#0d0e0c] p-3">
            <p className="text-[10px] uppercase font-bold tracking-wide text-[#8c9282] flex items-center gap-1">
              <Quote className="h-3 w-3" /> Podstawa — cytat z dokumentu
            </p>
            <p className="text-xs text-[#f1f2ec] mt-1 italic">„{suggestion.quote}"</p>
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={decline}
            disabled={saving}
            className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs"
          >
            Nie, dziękuję
          </Button>
          <Button
            type="button"
            onClick={accept}
            disabled={saving}
            className="flex-1 bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
          >
            {saving ? "Zapisywanie..." : "Dodaj badanie"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

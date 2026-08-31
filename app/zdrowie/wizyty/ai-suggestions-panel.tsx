"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sparkles, AlertTriangle } from "lucide-react";
import { IMAGING_MODALITIES } from "./constants";

/** Pojedyncza propozycja z trasy `summarize`. */
export interface AiSuggestion {
  current: string | null;
  proposed: string | null;
  changed: boolean;
}

export interface AiSuggestions {
  description: AiSuggestion;
  studyDate: AiSuggestion;
  doctor: AiSuggestion;
  bodyPart: AiSuggestion;
  modality: AiSuggestion;
}

export type AiSuggestionKey = keyof AiSuggestions;

const FIELD_LABELS: Record<AiSuggestionKey, string> = {
  description: "Opis badania",
  bodyPart: "Część ciała",
  modality: "Metoda",
  studyDate: "Data badania",
  doctor: "Lekarz",
};

/** Kolejność wierszy — od najbardziej treściwych do metadanych. */
const FIELD_ORDER: AiSuggestionKey[] = [
  "description",
  "bodyPart",
  "modality",
  "studyDate",
  "doctor",
];

/** Liczba propozycji, które faktycznie coś zmieniają — do plakietki na karcie. */
export function countChanged(s: AiSuggestions): number {
  return FIELD_ORDER.filter((k) => s[k]?.changed).length;
}

function display(key: AiSuggestionKey, value: string | null): string {
  if (value == null || value === "") return "(puste)";
  if (key === "studyDate") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : format(d, "dd.MM.yyyy");
  }
  if (key === "description") {
    const oneLine = value.replace(/\s+/g, " ").trim();
    return oneLine.length > 90 ? `${oneLine.slice(0, 90)}…` : oneLine;
  }
  return value;
}

interface Props {
  documentId: string;
  suggestions: AiSuggestions;
  /** Tagi dokumentu — modalność siedzi w `tags[0]`, resztę trzeba zachować. */
  currentTags: string[];
  onDismiss: () => void;
  onApplied: (doc: any) => void;
}

/**
 * Panel przeglądu sugestii AI.
 *
 * Zasada: **żadna sugestia nie zapisuje się sama**. Domyślnie zaznaczone są
 * wyłącznie te, które uzupełniają puste pole — nadpisanie istniejącej wartości
 * wymaga świadomego kliknięcia i jest oznaczone ostrzeżeniem.
 */
export function AiSuggestionsPanel({
  documentId,
  suggestions,
  currentTags,
  onDismiss,
  onApplied,
}: Props) {
  const [selected, setSelected] = useState<Set<AiSuggestionKey>>(() => {
    const init = new Set<AiSuggestionKey>();
    for (const key of FIELD_ORDER) {
      const s = suggestions[key];
      // Domyślnie tylko uzupełnienia pustych pól.
      if (s?.changed && (s.current == null || s.current === "")) init.add(key);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changedKeys = FIELD_ORDER.filter((k) => suggestions[k]?.changed);

  function toggle(key: AiSuggestionKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {};
    for (const key of selected) {
      const proposed = suggestions[key]?.proposed;
      if (proposed == null) continue;
      if (key === "modality") {
        // Modalność trzymamy w `tags[0]`; pozostałe tagi użytkownika zostają.
        const others = currentTags.filter((t) => !IMAGING_MODALITIES.includes(t));
        payload.tags = [proposed, ...others];
      } else {
        payload[key] = proposed;
      }
    }

    try {
      const res = await fetch(`/api/health/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError("Nie udało się zapisać zmian.");
        return;
      }
      onApplied(await res.json());
    } catch {
      setError("Błąd sieci przy zapisie.");
    } finally {
      setSaving(false);
    }
  }

  if (changedKeys.length === 0) {
    return (
      <div className="rounded-lg border border-[#2e3229] bg-[#0d0e0c] p-3 space-y-2">
        <p className="text-xs text-[#8c9282] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#bce663]" />
          AI nie znalazło nic do uzupełnienia — wszystko już się zgadza.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-[#2e3229] px-3 py-1.5 text-[10px] font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
        >
          Zamknij
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#bce663]/30 bg-[#bce663]/5 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#bce663] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Sugestie AI ({changedKeys.length})
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-[#2e3229] px-3 py-1.5 text-[10px] font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
          >
            Odrzuć wszystkie
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={saving || selected.size === 0}
            className="rounded-lg bg-[#bce663] px-3 py-1.5 text-[10px] font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all disabled:opacity-40"
          >
            {saving ? "Zapisuję…" : `Zastosuj zaznaczone (${selected.size})`}
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {FIELD_ORDER.map((key) => {
          const s = suggestions[key];
          if (!s) return null;
          const isChange = s.changed;
          const overwrites = isChange && s.current != null && s.current !== "";
          return (
            <li
              key={key}
              className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
                isChange ? "bg-[#0d0e0c]/60" : "opacity-40"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(key)}
                disabled={!isChange}
                onChange={() => toggle(key)}
                className="h-3.5 w-3.5 accent-[#bce663] mt-0.5 shrink-0 disabled:cursor-not-allowed"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[11px] font-bold text-[#f1f2ec]">
                    {FIELD_LABELS[key]}
                  </span>
                  <span className="text-[11px] text-[#8c9282] break-words">
                    {display(key, s.current)} →{" "}
                    <span className={isChange ? "text-[#f1f2ec]" : ""}>
                      {display(key, s.proposed)}
                    </span>
                  </span>
                  {!isChange && (
                    <span className="text-[10px] text-[#5d6050]">(bez zmian)</span>
                  )}
                </div>
                {overwrites && (
                  <p className="mt-0.5 text-[10px] text-amber-300 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                    nadpisze: «{display(key, s.current)}»
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
